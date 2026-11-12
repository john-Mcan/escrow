import "server-only";
import { milestoneEscrowAbi, SETTLED_MILESTONE_STATUSES, uuidToBytes32, type MilestoneStatus } from "@escrow/shared";
import type { Json } from "@escrow/shared/database";
import {
  type Address,
  type Hex,
  isAddressEqual,
  type Log,
  parseEventLogs,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
} from "viem";
import type { SyncResponse } from "@/lib/api-types";
import { getPublicClient } from "./chain";
import type { NotificationJob } from "./email/notifications";
import { getServerEnv } from "./env";
import { type EscrowRecord, refreshEscrowStatus, requireEscrowRecord, requireMilestone } from "./escrows";
import { ApiError, assertDb, assertDbOk } from "./http";
import { getSupabaseAdmin } from "./supabase";

type EscrowEvent = ReturnType<typeof decodeEscrowEvents>[number];
type EventOf<Name extends EscrowEvent["eventName"]> = Extract<EscrowEvent, { eventName: Name }>;

interface SyncContext {
  escrow: EscrowRecord;
  txHash: Hex;
  applied: SyncResponse["applied"];
  notifications: NotificationJob[];
}

const SETTLED_FILTER = `(${SETTLED_MILESTONE_STATUSES.join(",")})`;

function decodeEscrowEvents(logs: Log[]) {
  return parseEventLogs({ abi: milestoneEscrowAbi, logs });
}

/**
 * Reconciliación on-chain -> Supabase. El backend jamás confía en el frontend: solo recibe un `txHash`, lee el
 * recibo desde su propio RPC, decodifica los eventos de MilestoneEscrow y valida que correspondan a este acuerdo.
 * Es idempotente: (tx_hash, log_index) es único en escrow_activity_logs y solo la primera inserción notifica.
 */
export async function syncEscrowTransaction(escrowId: string, txHash: Hex) {
  const env = getServerEnv();
  const initial = await requireEscrowRecord(escrowId);
  if (initial.chain_id !== env.NEXT_PUBLIC_CHAIN_ID) {
    throw new ApiError(409, "wrong_chain", "Este acuerdo pertenece a otra red.");
  }

  const receipt = await waitForReceipt(txHash);
  if (receipt.status !== "success") {
    throw new ApiError(422, "tx_reverted", "La transacción falló on-chain y no movió fondos.");
  }

  const contractLogs = receipt.logs.filter((log) =>
    isAddressEqual(log.address, env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS),
  );
  const events = decodeEscrowEvents(contractLogs);
  const ctx: SyncContext = { escrow: initial, txHash, applied: [], notifications: [] };

  for (const event of events) {
    if (event.eventName === "EscrowCreated") {
      if (event.args.referenceId.toLowerCase() !== uuidToBytes32(initial.id)) continue;
      await applyEscrowCreated(ctx, event);
      ctx.escrow = await requireEscrowRecord(initial.id);
      continue;
    }
    if (!("escrowId" in event.args) || !("milestoneIndex" in event.args)) continue;
    if (!ctx.escrow.onchain_escrow_id || BigInt(ctx.escrow.onchain_escrow_id) !== event.args.escrowId) continue;

    switch (event.eventName) {
      case "MilestoneReleased":
        await applyMilestoneReleased(ctx, event);
        break;
      case "MilestoneRefunded":
        await applyMilestoneRefunded(ctx, event);
        break;
      case "DisputeRaised":
        await applyDisputeRaised(ctx, event);
        break;
      case "DisputeResolved":
        await applyDisputeResolved(ctx, event);
        break;
    }
  }

  if (ctx.applied.length === 0) {
    throw new ApiError(422, "no_matching_events", "La transacción no contiene eventos de este acuerdo.");
  }

  await refreshEscrowStatus(initial.id);
  return { applied: ctx.applied, notifications: ctx.notifications };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForReceipt(txHash: Hex) {
  const client = getPublicClient();

  // Un hash desconocido falla rápido (no retiene la request); los reintentos cubren el desfase entre nodos RPC.
  let known = false;
  for (let attempt = 0; attempt < 3 && !known; attempt++) {
    if (attempt > 0) await sleep(1_500);
    known = await client.getTransaction({ hash: txHash }).then(
      () => true,
      (error: unknown) => {
        if (error instanceof TransactionNotFoundError) return false;
        throw error;
      },
    );
  }
  if (!known) throw new ApiError(404, "tx_not_found", "No encontramos esa transacción en la red.");

  // El frontend llama al sync después de ver el recibo en su RPC: aquí solo se cubre el desfase entre nodos. Una
  // espera corta evita que un hash pendiente ajeno al contrato retenga la función. Si vence, el hash queda guardado
  // en el navegador y la vista del acuerdo reintenta el sync al volver a abrirse.
  try {
    return await client.waitForTransactionReceipt({ hash: txHash, confirmations: 1, timeout: 10_000 });
  } catch (error) {
    if (error instanceof WaitForTransactionReceiptTimeoutError || error instanceof TransactionReceiptNotFoundError) {
      throw new ApiError(409, "tx_pending", "La transacción aún no se confirma. Reintenta en unos segundos.");
    }
    throw error;
  }
}

/** Inserta el log on-chain. Devuelve false si el evento ya estaba registrado (reintento o sync concurrente). */
async function recordActivity(
  ctx: SyncContext,
  row: {
    action_type: "funded" | "released" | "refunded" | "dispute_opened" | "dispute_resolved";
    log_index: number;
    milestone_id?: string;
    actor_address: Address;
    metadata: Json;
  },
): Promise<boolean> {
  const inserted = assertDb(
    await getSupabaseAdmin()
      .from("escrow_activity_logs")
      .upsert(
        { escrow_id: ctx.escrow.id, tx_hash: ctx.txHash, ...row, actor_address: row.actor_address.toLowerCase() },
        { onConflict: "tx_hash,log_index", ignoreDuplicates: true },
      )
      .select("id"),
    "insert activity",
  );
  return inserted.length > 0;
}

function pushApplied(
  ctx: SyncContext,
  eventName: string,
  logIndex: number,
  milestoneIndex: number | null,
  isNew: boolean,
) {
  ctx.applied.push({ eventName, logIndex, milestoneIndex, duplicate: !isNew });
}

async function applyEscrowCreated(ctx: SyncContext, event: EventOf<"EscrowCreated">) {
  const env = getServerEnv();
  const { escrow } = ctx;
  const { args } = event;

  const expected = escrow.milestones.map((m) => BigInt(m.amount));
  const mismatches: string[] = [];
  if (!isAddressEqual(args.payee, escrow.payee_address as Address)) mismatches.push("payee");
  if (!isAddressEqual(args.token, env.NEXT_PUBLIC_USDC_ADDRESS)) mismatches.push("token");
  if (args.totalAmount !== BigInt(escrow.total_amount)) mismatches.push("total_amount");
  if (args.milestoneAmounts.length !== expected.length || args.milestoneAmounts.some((a, i) => a !== expected[i])) {
    mismatches.push("milestones");
  }
  if (mismatches.length > 0) {
    throw new ApiError(422, "funding_mismatch", "El depósito on-chain no coincide con el acuerdo.", {
      fields: mismatches,
    });
  }

  const onchainId = args.escrowId.toString();
  if (escrow.onchain_escrow_id && escrow.onchain_escrow_id !== onchainId) {
    throw new ApiError(409, "already_funded", "Este acuerdo ya fue fondeado con otra transacción.");
  }
  if (escrow.status === "cancelled") {
    throw new ApiError(409, "escrow_cancelled", "Este acuerdo fue cancelado.");
  }

  const supabase = getSupabaseAdmin();
  if (!escrow.onchain_escrow_id) {
    assertDbOk(
      await supabase
        .from("escrows")
        .update({
          status: "funded",
          // Ids secuenciales del contrato: caben holgadamente en Number.
          onchain_escrow_id: Number(args.escrowId),
          contract_address: env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS,
          tx_hash_funded: ctx.txHash,
          platform_fee_bps: args.feeBps,
          payer_address: args.payer.toLowerCase(),
        })
        .eq("id", escrow.id)
        .eq("status", "draft")
        .is("onchain_escrow_id", null),
      "mark escrow funded",
    );
  }
  assertDbOk(
    await supabase.from("milestones").update({ status: "funded" }).eq("escrow_id", escrow.id).eq("status", "pending"),
    "mark milestones funded",
  );

  const isNew = await recordActivity(ctx, {
    action_type: "funded",
    log_index: event.logIndex,
    actor_address: args.payer,
    metadata: { onchain_escrow_id: onchainId, total_amount: args.totalAmount.toString(), fee_bps: args.feeBps },
  });
  pushApplied(ctx, event.eventName, event.logIndex, null, isNew);
  if (isNew)
    ctx.notifications.push({ type: "funded", escrowId: escrow.id, txHash: ctx.txHash, logIndex: event.logIndex });
}

/** Marca un hito como liquidado salvo que ya lo esté (on-chain es la fuente de verdad; no hay regresiones). */
async function settleMilestone(ctx: SyncContext, milestoneIndex: number, status: MilestoneStatus) {
  assertDbOk(
    await getSupabaseAdmin()
      .from("milestones")
      .update({ status, tx_hash_settled: ctx.txHash })
      .eq("escrow_id", ctx.escrow.id)
      .eq("milestone_index", milestoneIndex)
      .not("status", "in", SETTLED_FILTER),
    `settle milestone ${milestoneIndex}`,
  );
}

async function applyMilestoneReleased(ctx: SyncContext, event: EventOf<"MilestoneReleased">) {
  const index = Number(event.args.milestoneIndex);
  const milestone = requireMilestone(ctx.escrow, index);
  await settleMilestone(ctx, index, "released");
  const isNew = await recordActivity(ctx, {
    action_type: "released",
    log_index: event.logIndex,
    milestone_id: milestone.id,
    actor_address: ctx.escrow.payer_address as Address,
    metadata: {
      amount: event.args.amount.toString(),
      payee_amount: event.args.payeeAmount.toString(),
      fee: event.args.fee.toString(),
    },
  });
  pushApplied(ctx, event.eventName, event.logIndex, index, isNew);
  if (isNew) {
    ctx.notifications.push({
      type: "released",
      escrowId: ctx.escrow.id,
      milestoneIndex: index,
      payeeAmount: event.args.payeeAmount,
      fee: event.args.fee,
      txHash: ctx.txHash,
      logIndex: event.logIndex,
    });
  }
}

async function applyMilestoneRefunded(ctx: SyncContext, event: EventOf<"MilestoneRefunded">) {
  const index = Number(event.args.milestoneIndex);
  const milestone = requireMilestone(ctx.escrow, index);
  await settleMilestone(ctx, index, "refunded");
  const isNew = await recordActivity(ctx, {
    action_type: "refunded",
    log_index: event.logIndex,
    milestone_id: milestone.id,
    actor_address: ctx.escrow.payee_address as Address,
    metadata: { amount: event.args.amount.toString() },
  });
  pushApplied(ctx, event.eventName, event.logIndex, index, isNew);
  if (isNew) {
    ctx.notifications.push({
      type: "refunded",
      escrowId: ctx.escrow.id,
      milestoneIndex: index,
      amount: event.args.amount,
      txHash: ctx.txHash,
      logIndex: event.logIndex,
    });
  }
}

async function applyDisputeRaised(ctx: SyncContext, event: EventOf<"DisputeRaised">) {
  const index = Number(event.args.milestoneIndex);
  const milestone = requireMilestone(ctx.escrow, index);
  assertDbOk(
    await getSupabaseAdmin()
      .from("milestones")
      .update({ status: "disputed" })
      .eq("escrow_id", ctx.escrow.id)
      .eq("milestone_index", index)
      .in("status", ["funded", "delivered_review"]),
    "mark milestone disputed",
  );
  const isNew = await recordActivity(ctx, {
    action_type: "dispute_opened",
    log_index: event.logIndex,
    milestone_id: milestone.id,
    actor_address: event.args.raisedBy,
    metadata: { raised_by: event.args.raisedBy.toLowerCase() },
  });
  pushApplied(ctx, event.eventName, event.logIndex, index, isNew);
  if (isNew) {
    ctx.notifications.push({
      type: "dispute_opened",
      escrowId: ctx.escrow.id,
      milestoneIndex: index,
      raisedBy: event.args.raisedBy,
      txHash: ctx.txHash,
      logIndex: event.logIndex,
    });
  }
}

async function applyDisputeResolved(ctx: SyncContext, event: EventOf<"DisputeResolved">) {
  const index = Number(event.args.milestoneIndex);
  const milestone = requireMilestone(ctx.escrow, index);
  await settleMilestone(ctx, index, "resolved");
  const { args } = event;
  const isNew = await recordActivity(ctx, {
    action_type: "dispute_resolved",
    log_index: event.logIndex,
    milestone_id: milestone.id,
    actor_address: args.arbiter,
    metadata: {
      payer_share_bps: Number(args.payerShareBps),
      payer_amount: args.payerAmount.toString(),
      payee_amount: args.payeeAmount.toString(),
      fee: args.fee.toString(),
    },
  });
  pushApplied(ctx, event.eventName, event.logIndex, index, isNew);
  if (isNew) {
    ctx.notifications.push({
      type: "dispute_resolved",
      escrowId: ctx.escrow.id,
      milestoneIndex: index,
      payerAmount: args.payerAmount,
      payeeAmount: args.payeeAmount,
      fee: args.fee,
      txHash: ctx.txHash,
      logIndex: event.logIndex,
    });
  }
}
