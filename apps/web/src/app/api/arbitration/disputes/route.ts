import type { DisputesResponse } from "@/lib/api-types";
import { isArbitrationAdmin, requireUser } from "@/lib/server/auth";
import { ApiError, assertDb, json, withErrorHandling } from "@/lib/server/http";
import { getSupabaseAdmin } from "@/lib/server/supabase";

/**
 * Cola del panel de arbitraje. Este endpoint solo LEE: la resolución se firma fuera del servidor (Safe multisig o
 * hardware wallet del arbiter) y luego se reconcilia con /api/escrow/sync.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireUser(request);
  if (!isArbitrationAdmin(user)) throw new ApiError(403, "forbidden", "No tienes acceso al panel de arbitraje.");

  const supabase = getSupabaseAdmin();
  const milestones = assertDb(
    await supabase
      .from("milestones")
      .select(
        `id, milestone_index, title, amount::text, deliverable_url, deliverable_notes,
         escrow:escrows!inner (id, short_code, title, chain_id, onchain_escrow_id::text, platform_fee_bps,
                               payer_address, payee_address, payer_email, payee_email)`,
      )
      .eq("status", "disputed")
      .order("updated_at", { ascending: true }),
    "load disputes",
  );

  const ids = milestones.map((m) => m.id);
  const [evidence, openings] = ids.length
    ? await Promise.all([
        supabase
          .from("disputes_evidence")
          .select("id, milestone_id, comment, attachment_url, created_at, submitter:users (display_name, email)")
          .in("milestone_id", ids)
          .order("created_at", { ascending: true }),
        supabase
          .from("escrow_activity_logs")
          .select("milestone_id, created_at")
          .eq("action_type", "dispute_opened")
          .in("milestone_id", ids),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  const evidenceRows = assertDb(evidence, "load evidence");
  const openingRows = assertDb(openings, "load dispute openings");

  const disputes = milestones.map((m) => ({
    escrowId: m.escrow.id,
    shortCode: m.escrow.short_code,
    title: m.escrow.title,
    chainId: m.escrow.chain_id,
    onchainEscrowId: m.escrow.onchain_escrow_id ?? "",
    platformFeeBps: m.escrow.platform_fee_bps ?? 0,
    payerAddress: m.escrow.payer_address ?? "",
    payeeAddress: m.escrow.payee_address,
    payerEmail: m.escrow.payer_email,
    payeeEmail: m.escrow.payee_email,
    milestone: {
      index: m.milestone_index,
      title: m.title,
      amount: m.amount,
      deliverableUrl: m.deliverable_url,
      deliverableNotes: m.deliverable_notes,
    },
    evidence: evidenceRows
      .filter((row) => row.milestone_id === m.id)
      .map((row) => ({
        id: row.id,
        milestoneIndex: m.milestone_index,
        submittedBy: row.submitter?.display_name ?? row.submitter?.email ?? null,
        comment: row.comment,
        attachmentUrl: row.attachment_url,
        createdAt: row.created_at,
      })),
    openedAt: openingRows.filter((row) => row.milestone_id === m.id).at(-1)?.created_at ?? null,
  }));

  return json<DisputesResponse>({ disputes });
});
