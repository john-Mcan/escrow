import { evidenceSchema } from "@escrow/shared";
import { requireUser } from "@/lib/server/auth";
import { participantRole, requireEscrowRecord, requireMilestone } from "@/lib/server/escrows";
import { ApiError, assertDb, json, parseJsonBody, withErrorHandling } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseAdmin } from "@/lib/server/supabase";

/** Evidencia para el árbitro. Solo participantes y solo en hitos en disputa; la tabla es append-only. */
export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ escrowId: string }> }) => {
  const { escrowId } = await params;
  const user = await requireUser(request);
  const escrow = await requireEscrowRecord(escrowId);
  if (!participantRole(escrow, user)) throw new ApiError(403, "forbidden", "No participas en este acuerdo.");

  const data = await parseJsonBody(request, evidenceSchema);
  const milestone = requireMilestone(escrow, data.milestoneIndex);
  if (milestone.status !== "disputed") {
    throw new ApiError(409, "invalid_status", "Solo puedes aportar evidencia en hitos en disputa.");
  }
  await enforceRateLimit("evidence", user.id);

  const evidence = assertDb(
    await getSupabaseAdmin()
      .from("disputes_evidence")
      .insert({
        escrow_id: escrow.id,
        milestone_id: milestone.id,
        submitted_by: user.id,
        comment: data.comment,
        attachment_url: data.attachmentUrl ?? null,
      })
      .select("id")
      .single(),
    "insert evidence",
  );
  return json({ id: evidence.id }, { status: 201 });
});
