import type { Database } from "./database.types";

export type EscrowStatus = Database["public"]["Enums"]["escrow_status"];
export type MilestoneStatus = Database["public"]["Enums"]["milestone_status"];
export type EscrowActionType = Database["public"]["Enums"]["escrow_action_type"];

/** Orden idéntico a `MilestoneEscrow.MilestoneStatus` (el índice es el valor on-chain). */
export const ONCHAIN_MILESTONE_STATUSES = ["Pending", "Funded", "Released", "Refunded", "Disputed", "Resolved"] as const;
export type OnchainMilestoneStatus = (typeof ONCHAIN_MILESTONE_STATUSES)[number];

export const SETTLED_MILESTONE_STATUSES = ["released", "refunded", "resolved"] as const satisfies readonly MilestoneStatus[];

/** Hitos que el payer puede liberar y que cualquiera de las partes puede disputar (on-chain: Funded). */
export const ACTIVE_MILESTONE_STATUSES = ["funded", "delivered_review"] as const satisfies readonly MilestoneStatus[];

export function isSettled(status: MilestoneStatus): boolean {
  return (SETTLED_MILESTONE_STATUSES as readonly MilestoneStatus[]).includes(status);
}

export function isActive(status: MilestoneStatus): boolean {
  return (ACTIVE_MILESTONE_STATUSES as readonly MilestoneStatus[]).includes(status);
}

/** Estado agregado del escrow a partir de sus hitos. */
export function deriveEscrowStatus(milestones: readonly MilestoneStatus[]): EscrowStatus {
  if (milestones.length === 0 || milestones.includes("pending")) return "draft";
  if (milestones.includes("disputed")) return "disputed";
  if (milestones.every(isSettled)) {
    return milestones.every((status) => status === "refunded") ? "cancelled" : "completed";
  }
  if (milestones.some((status) => isSettled(status) || status === "delivered_review")) return "in_progress";
  return "funded";
}
