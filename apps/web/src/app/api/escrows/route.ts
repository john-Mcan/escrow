import { createEscrowSchema, formatUsdc, milestoneEscrowAbi } from "@escrow/shared";
import { after } from "next/server";
import type { CreateEscrowResponse, EscrowListResponse } from "@/lib/api-types";
import { requireUser } from "@/lib/server/auth";
import { getPublicClient } from "@/lib/server/chain";
import { deliverNotification } from "@/lib/server/email/notifications";
import { getServerEnv } from "@/lib/server/env";
import { ApiError, assertDb, json, parseJsonBody, withErrorHandling } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireUser(request);
  const rows = assertDb(
    await getSupabaseAdmin()
      .rpc("list_user_escrows", { p_user_id: user.id })
      .select(
        "id, short_code, title, status, total_amount::text, created_at, creator_id, payer_email, payee_email, payer_address, payee_address",
      ),
    "list escrows",
  );

  const escrows = rows.map((row) => {
    const isPayee = row.creator_id === user.id || (!!user.wallet_address && row.payee_address === user.wallet_address);
    return {
      id: row.id,
      shortCode: row.short_code,
      title: row.title,
      status: row.status,
      totalAmount: row.total_amount,
      createdAt: row.created_at,
      role: isPayee ? ("payee" as const) : ("payer" as const),
      counterparty: isPayee ? (row.payer_email ?? row.payer_address) : (row.payee_email ?? row.payee_address),
    };
  });
  return json<EscrowListResponse>({ escrows });
});

/** El proveedor crea un borrador y obtiene el link de checkout. El payee es SIEMPRE su wallet verificada. */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser(request);
  const data = await parseJsonBody(request, createEscrowSchema);
  const env = getServerEnv();

  if (!user.wallet_address) {
    throw new ApiError(409, "wallet_required", "Tu cuenta aún no tiene una wallet. Vuelve a ingresar para crearla.");
  }
  if (data.payerEmail && data.payerEmail === user.email) {
    throw new ApiError(422, "self_invite", "No puedes enviarte un cobro a ti mismo.");
  }
  // Cada link puede enviar una invitación a cualquier email: el límite protege la reputación del dominio de envío.
  await enforceRateLimit("create_escrow", user.id);

  // El límite vigente vive on-chain (configurable por la Safe owner): evita crear links imposibles de fondear.
  const total = data.milestones.reduce((sum, milestone) => sum + milestone.amount, 0n);
  const maxAmount = await getPublicClient()
    .readContract({
      address: env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS,
      abi: milestoneEscrowAbi,
      functionName: "maxEscrowAmount",
    })
    .catch(() => null);
  if (maxAmount !== null && total > maxAmount) {
    throw new ApiError(
      422,
      "amount_exceeds_max",
      `El total supera el máximo por acuerdo de ${formatUsdc(maxAmount)} USDC.`,
    );
  }

  const escrow = assertDb(
    await getSupabaseAdmin().rpc("create_escrow_draft", {
      p_creator_id: user.id,
      p_chain_id: env.NEXT_PUBLIC_CHAIN_ID,
      p_title: data.title,
      p_payee_address: user.wallet_address,
      p_milestones: data.milestones.map((milestone) => ({
        title: milestone.title,
        description: milestone.description ?? null,
        amount: milestone.amount.toString(),
        due_date: milestone.dueDate ?? null,
      })),
      p_description: data.description,
      p_payer_email: data.payerEmail,
      p_payee_email: user.email ?? undefined,
    }),
    "create escrow draft",
  );

  if (data.payerEmail) {
    after(() => deliverNotification({ type: "invitation", escrowId: escrow.id }));
  }

  return json<CreateEscrowResponse>(
    {
      id: escrow.id,
      shortCode: escrow.short_code,
      url: `${env.NEXT_PUBLIC_APP_URL}/pay/${escrow.short_code}`,
      invitationSent: !!data.payerEmail,
    },
    { status: 201 },
  );
});
