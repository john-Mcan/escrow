import "server-only";
import { explorerTxUrl, formatUsdc, type SupportedChainId } from "@escrow/shared";
import { Resend } from "resend";
import type { Hex } from "viem";
import { getServerEnv } from "../env";
import { getEscrowRecord, type EscrowRecord } from "../escrows";
import { getSupabaseAdmin } from "../supabase";
import {
  deliverableEmail,
  disputeOpenedEmail,
  disputeResolvedEmail,
  type EmailMessage,
  fundedForPayeeEmail,
  fundedForPayerEmail,
  invitationEmail,
  refundedEmail,
  releasedEmail,
} from "./templates";

interface OnchainRef {
  txHash: Hex;
  logIndex: number;
}

/** Eventos que disparan correos. Se encolan durante la request y se envían con `after()`. */
export type NotificationJob =
  | { type: "invitation"; escrowId: string }
  | ({ type: "funded"; escrowId: string } & OnchainRef)
  | { type: "deliverable"; escrowId: string; milestoneIndex: number; activityId: number }
  | ({ type: "released"; escrowId: string; milestoneIndex: number; payeeAmount: bigint; fee: bigint } & OnchainRef)
  | ({ type: "refunded"; escrowId: string; milestoneIndex: number; amount: bigint } & OnchainRef)
  | ({ type: "dispute_opened"; escrowId: string; milestoneIndex: number; raisedBy: string } & OnchainRef)
  | ({
      type: "dispute_resolved";
      escrowId: string;
      milestoneIndex: number;
      payerAmount: bigint;
      payeeAmount: bigint;
      fee: bigint;
    } & OnchainRef);

interface Outgoing extends EmailMessage {
  to: string;
}

let resend: Resend | null | undefined;

function getResend(): Resend | null {
  if (resend === undefined) {
    const key = getServerEnv().RESEND_API_KEY;
    resend = key ? new Resend(key) : null;
  }
  return resend;
}

async function resolveParties(escrow: EscrowRecord) {
  const supabase = getSupabaseAdmin();
  const [{ data: creator }, payerLookup] = await Promise.all([
    supabase.from("users").select("email, display_name").eq("id", escrow.creator_id).maybeSingle(),
    escrow.payer_address
      ? supabase.from("users").select("email").eq("wallet_address", escrow.payer_address).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    providerName: creator?.display_name ?? "Tu proveedor",
    payeeEmail: escrow.payee_email ?? creator?.email ?? null,
    payerEmail: escrow.payer_email ?? payerLookup.data?.email ?? null,
  };
}

function idempotencyKey(job: NotificationJob): string {
  switch (job.type) {
    case "invitation":
      return `batch-invitation/${job.escrowId}`;
    case "deliverable":
      return `batch-deliverable/${job.activityId}`;
    default:
      return `batch-${job.type}/${job.txHash}-${job.logIndex}`;
  }
}

function buildMessages(
  job: NotificationJob,
  escrow: EscrowRecord,
  parties: Awaited<ReturnType<typeof resolveParties>>,
): Outgoing[] {
  const env = getServerEnv();
  const checkoutUrl = `${env.NEXT_PUBLIC_APP_URL}/pay/${escrow.short_code}`;
  const ctx = { title: escrow.title, providerName: parties.providerName, checkoutUrl };
  const receiptUrl = "txHash" in job ? explorerTxUrl(escrow.chain_id as SupportedChainId, job.txHash) : null;
  const milestone =
    "milestoneIndex" in job ? escrow.milestones.find((m) => m.milestone_index === job.milestoneIndex) : undefined;
  const milestoneTitle = milestone?.title ?? "Hito";
  const out: Outgoing[] = [];
  const push = (to: string | null, message: EmailMessage) => {
    if (to) out.push({ to, ...message });
  };

  switch (job.type) {
    case "invitation":
      push(
        parties.payerEmail,
        invitationEmail({ ...ctx, total: formatUsdc(escrow.total_amount), milestones: escrow.milestones.length }),
      );
      break;
    case "funded": {
      const total = formatUsdc(escrow.total_amount);
      push(parties.payeeEmail, fundedForPayeeEmail({ ...ctx, total, receiptUrl }));
      push(parties.payerEmail, fundedForPayerEmail({ ...ctx, total, receiptUrl }));
      break;
    }
    case "deliverable":
      push(
        parties.payerEmail,
        deliverableEmail({
          ...ctx,
          milestoneTitle,
          amount: formatUsdc(milestone?.amount ?? "0"),
          notes: milestone?.deliverable_notes ?? null,
        }),
      );
      break;
    case "released":
      push(
        parties.payeeEmail,
        releasedEmail({
          ...ctx,
          milestoneTitle,
          payeeAmount: formatUsdc(job.payeeAmount),
          fee: formatUsdc(job.fee),
          receiptUrl,
        }),
      );
      break;
    case "refunded":
      push(parties.payerEmail, refundedEmail({ ...ctx, milestoneTitle, amount: formatUsdc(job.amount), receiptUrl }));
      break;
    case "dispute_opened": {
      const openedBy = job.raisedBy.toLowerCase() === escrow.payer_address ? "El cliente" : "El proveedor";
      const base = { ...ctx, milestoneTitle, amount: formatUsdc(milestone?.amount ?? "0"), openedBy };
      push(parties.payeeEmail, disputeOpenedEmail(base));
      push(parties.payerEmail, disputeOpenedEmail(base));
      for (const admin of env.ARBITRATION_ADMIN_EMAILS) {
        push(
          admin,
          disputeOpenedEmail({ ...base, forArbitration: true, checkoutUrl: `${env.NEXT_PUBLIC_APP_URL}/arbitration` }),
        );
      }
      break;
    }
    case "dispute_resolved": {
      const message = disputeResolvedEmail({
        ...ctx,
        milestoneTitle,
        payerAmount: formatUsdc(job.payerAmount),
        payeeAmount: formatUsdc(job.payeeAmount),
        fee: formatUsdc(job.fee),
        receiptUrl,
      });
      push(parties.payeeEmail, message);
      push(parties.payerEmail, message);
      break;
    }
  }

  // Un destinatario no recibe el mismo correo dos veces (p. ej. si payer y payee comparten email).
  return out.filter(
    (message, index) => out.findIndex((m) => m.to === message.to && m.subject === message.subject) === index,
  );
}

/** Envía los correos de un evento. Nunca lanza: un fallo de email no debe revertir una reconciliación on-chain. */
export async function deliverNotification(job: NotificationJob): Promise<void> {
  try {
    const escrow = await getEscrowRecord(job.escrowId);
    if (!escrow) return;
    const messages = buildMessages(job, escrow, await resolveParties(escrow));
    if (messages.length === 0) return;

    const env = getServerEnv();
    const client = getResend();
    if (!client) {
      for (const message of messages) {
        console.info(`[email:dev] ${job.type} -> ${message.to} | ${message.subject}\n${message.text}\n`);
      }
      return;
    }

    const { error } = await client.batch.send(
      messages.map((message) => ({
        from: env.EMAIL_FROM,
        to: [message.to],
        replyTo: env.EMAIL_REPLY_TO,
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: [{ name: "event", value: job.type }],
      })),
      { idempotencyKey: idempotencyKey(job) },
    );
    if (error) console.error(`[email] ${job.type} (${job.escrowId}):`, error.message);
  } catch (error) {
    console.error(`[email] ${job.type} (${job.escrowId}) falló`, error);
  }
}

export async function deliverNotifications(jobs: NotificationJob[]): Promise<void> {
  for (const job of jobs) {
    await deliverNotification(job);
  }
}
