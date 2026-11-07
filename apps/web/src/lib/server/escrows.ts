import "server-only";
import { deriveEscrowStatus, isUuid, type PublicCheckout } from "@escrow/shared";
import type { ParticipantRole } from "@/lib/api-types";
import type { AppUser } from "./auth";
import { ApiError, assertDb, assertDbMaybe, assertDbOk } from "./http";
import { getSupabaseAdmin } from "./supabase";

/** Montos e ids on-chain se leen como texto (numeric(78,0) puede exceder Number.MAX_SAFE_INTEGER). */
const ESCROW_SELECT = `
  id, short_code, chain_id, contract_address, onchain_escrow_id::text, tx_hash_funded, platform_fee_bps,
  title, description, creator_id, payer_email, payee_email, payer_address, payee_address,
  total_amount::text, status, created_at,
  milestones (
    id, milestone_index, title, description, deliverable_url, deliverable_notes,
    amount::text, due_date, status, tx_hash_settled
  )
`;

async function selectEscrow(column: "id" | "short_code", value: string) {
  const result = await getSupabaseAdmin()
    .from("escrows")
    .select(ESCROW_SELECT)
    .eq(column, value)
    .order("milestone_index", { referencedTable: "milestones" })
    .maybeSingle();
  return assertDbMaybe(result, "select escrow");
}

export type EscrowRecord = NonNullable<Awaited<ReturnType<typeof selectEscrow>>>;
export type MilestoneRecord = EscrowRecord["milestones"][number];

/** Busca por UUID o por short_code. */
export async function getEscrowRecord(reference: string): Promise<EscrowRecord | null> {
  if (isUuid(reference)) return selectEscrow("id", reference.toLowerCase());
  if (/^[A-Za-z0-9]{6,16}$/.test(reference)) return selectEscrow("short_code", reference);
  return null;
}

export async function requireEscrowRecord(reference: string): Promise<EscrowRecord> {
  const escrow = await getEscrowRecord(reference);
  if (!escrow) throw new ApiError(404, "escrow_not_found", "No encontramos este acuerdo.");
  return escrow;
}

export function requireMilestone(escrow: EscrowRecord, milestoneIndex: number): MilestoneRecord {
  const milestone = escrow.milestones.find((m) => m.milestone_index === milestoneIndex);
  if (!milestone) throw new ApiError(404, "milestone_not_found", "Ese hito no existe en este acuerdo.");
  return milestone;
}

export async function getPublicCheckout(reference: string): Promise<PublicCheckout | null> {
  const result = await getSupabaseAdmin().rpc("get_public_checkout", { p_reference: reference });
  return (assertDbMaybe(result, "get_public_checkout") as unknown as PublicCheckout | null) ?? null;
}

/**
 * El creador del link es el proveedor (payee); el payer participa por wallet (después del depósito) o por el email
 * al que se envió la invitación.
 */
export function participantRole(escrow: EscrowRecord, user: AppUser): ParticipantRole | null {
  if (escrow.creator_id === user.id || (!!user.wallet_address && escrow.payee_address === user.wallet_address)) {
    return "payee";
  }
  if (
    (!!user.wallet_address && escrow.payer_address === user.wallet_address) ||
    (!!user.email && escrow.payer_email === user.email)
  ) {
    return "payer";
  }
  return null;
}

/** Recalcula el estado agregado del escrow a partir de sus hitos (solo después del fondeo). */
export async function refreshEscrowStatus(escrowId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const escrow = assertDb(
    await supabase.from("escrows").select("status, milestones (status)").eq("id", escrowId).single(),
    "load escrow status",
  );
  if (escrow.status === "draft") return;
  const next = deriveEscrowStatus(escrow.milestones.map((m) => m.status));
  if (next !== escrow.status && next !== "draft") {
    assertDbOk(await supabase.from("escrows").update({ status: next }).eq("id", escrowId), "update escrow status");
  }
}
