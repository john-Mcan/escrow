import { deliverableSchema } from "@escrow/shared";
import { after } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { deliverNotification } from "@/lib/server/email/notifications";
import { participantRole, refreshEscrowStatus, requireEscrowRecord, requireMilestone } from "@/lib/server/escrows";
import { ApiError, assertDb, json, parseJsonBody, withErrorHandling } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseAdmin } from "@/lib/server/supabase";

type Params = { params: Promise<{ escrowId: string; milestoneIndex: string }> };

/** Acción off-chain: el proveedor adjunta el entregable y el cliente recibe un email para revisar y liberar. */
export const POST = withErrorHandling(async (request: Request, { params }: Params) => {
  const { escrowId, milestoneIndex } = await params;
  const index = Number(milestoneIndex);
  if (!Number.isInteger(index) || index < 0) throw new ApiError(404, "milestone_not_found", "Ese hito no existe.");

  const user = await requireUser(request);
  const escrow = await requireEscrowRecord(escrowId);
  if (participantRole(escrow, user) !== "payee") {
    throw new ApiError(403, "forbidden", "Solo el proveedor puede subir entregables.");
  }
  const milestone = requireMilestone(escrow, index);
  if (milestone.status !== "funded" && milestone.status !== "delivered_review") {
    throw new ApiError(409, "invalid_status", "Este hito no admite entregas en su estado actual.");
  }

  const data = await parseJsonBody(request, deliverableSchema);
  await enforceRateLimit("deliverable", user.id);
  const supabase = getSupabaseAdmin();

  const updated = assertDb(
    await supabase
      .from("milestones")
      .update({ deliverable_url: data.url, deliverable_notes: data.notes ?? null, status: "delivered_review" })
      .eq("id", milestone.id)
      .in("status", ["funded", "delivered_review"])
      .select("id"),
    "save deliverable",
  );
  if (updated.length === 0) {
    throw new ApiError(409, "invalid_status", "El hito cambió de estado. Recarga la página.");
  }

  const activity = assertDb(
    await supabase
      .from("escrow_activity_logs")
      .insert({
        escrow_id: escrow.id,
        milestone_id: milestone.id,
        action_type: "deliverable_submitted",
        actor_address: user.wallet_address,
        metadata: { deliverable_url: data.url },
      })
      .select("id")
      .single(),
    "log deliverable",
  );
  await refreshEscrowStatus(escrow.id);

  after(() =>
    deliverNotification({ type: "deliverable", escrowId: escrow.id, milestoneIndex: index, activityId: activity.id }),
  );
  return json({ ok: true });
});
