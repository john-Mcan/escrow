import type { EscrowDetailResponse } from "@/lib/api-types";
import { isArbitrationAdmin, requireUser } from "@/lib/server/auth";
import { participantRole, requireEscrowRecord } from "@/lib/server/escrows";
import { ApiError, assertDb, json, withErrorHandling } from "@/lib/server/http";
import { getSupabaseAdmin } from "@/lib/server/supabase";

/** Vista privada del acuerdo para sus participantes: entregables, emails, historial y evidencias. */
export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ escrowId: string }> }) => {
    const { escrowId } = await params;
    const user = await requireUser(request);
    const escrow = await requireEscrowRecord(escrowId);

    const role = participantRole(escrow, user) ?? (isArbitrationAdmin(user) ? "arbitration" : null);
    if (!role) throw new ApiError(403, "forbidden", "No participas en este acuerdo.");

    const supabase = getSupabaseAdmin();
    const [activity, evidence] = await Promise.all([
      supabase
        .from("escrow_activity_logs")
        .select("id, action_type, milestone_id, actor_address, tx_hash, metadata, created_at")
        .eq("escrow_id", escrow.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("disputes_evidence")
        .select("id, milestone_id, comment, attachment_url, created_at, submitter:users (display_name, email)")
        .eq("escrow_id", escrow.id)
        .order("created_at", { ascending: true }),
    ]);

    const indexById = new Map(escrow.milestones.map((m) => [m.id, m.milestone_index]));

    return json<EscrowDetailResponse>({
      role,
      payerEmail: escrow.payer_email,
      payeeEmail: escrow.payee_email,
      milestones: escrow.milestones.map((m) => ({
        milestoneIndex: m.milestone_index,
        status: m.status,
        deliverableUrl: m.deliverable_url,
        deliverableNotes: m.deliverable_notes,
      })),
      activity: assertDb(activity, "load activity").map((row) => ({
        id: row.id,
        actionType: row.action_type,
        milestoneIndex: row.milestone_id ? (indexById.get(row.milestone_id) ?? null) : null,
        actorAddress: row.actor_address,
        txHash: row.tx_hash,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: row.created_at,
      })),
      evidence: assertDb(evidence, "load evidence").map((row) => ({
        id: row.id,
        milestoneIndex: indexById.get(row.milestone_id) ?? 0,
        submittedBy: row.submitter?.display_name ?? row.submitter?.email ?? null,
        comment: row.comment,
        attachmentUrl: row.attachment_url,
        createdAt: row.created_at,
      })),
    });
  },
);
