import type { EscrowActionType, EscrowStatus, MilestoneStatus } from "@escrow/shared";

export function shortAddress(address: string | null | undefined): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const dateFormatter = new Intl.DateTimeFormat("es-419", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-419", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** `due_date` llega como "YYYY-MM-DD": se interpreta en UTC para no correr el día por zona horaria. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return dateFormatter.format(date);
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  draft: "Esperando depósito",
  funded: "En garantía",
  in_progress: "En curso",
  completed: "Completado",
  disputed: "En disputa",
  cancelled: "Cancelado",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Por depositar",
  funded: "En garantía",
  delivered_review: "Entregado, por revisar",
  released: "Pagado",
  refunded: "Reembolsado",
  disputed: "En disputa",
  resolved: "Resuelto por árbitro",
};

export const ACTIVITY_LABELS: Record<EscrowActionType, string> = {
  created: "Link de cobro creado",
  funded: "Depósito en garantía",
  deliverable_submitted: "Entregable subido",
  released: "Pago liberado",
  refunded: "Hito reembolsado",
  dispute_opened: "Disputa abierta",
  dispute_resolved: "Disputa resuelta",
};

export type StatusTone = "neutral" | "vault" | "seal" | "caution" | "muted";

export function milestoneTone(status: MilestoneStatus): StatusTone {
  switch (status) {
    case "funded":
    case "delivered_review":
      return "vault";
    case "released":
    case "resolved":
      return "seal";
    case "disputed":
      return "caution";
    case "refunded":
      return "muted";
    default:
      return "neutral";
  }
}

export function escrowTone(status: EscrowStatus): StatusTone {
  switch (status) {
    case "funded":
    case "in_progress":
      return "vault";
    case "completed":
      return "seal";
    case "disputed":
      return "caution";
    case "cancelled":
      return "muted";
    default:
      return "neutral";
  }
}

export const CHAIN_LABELS: Record<number, string> = {
  8453: "Base",
  84532: "Base Sepolia (prueba)",
  31337: "Anvil (local)",
};
