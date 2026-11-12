import type { EscrowActionType, EscrowStatus, MilestoneStatus, PublicCheckout } from "@escrow/shared";

/** Contratos JSON entre los Route Handlers y el cliente. Montos siempre como string (unidades base de USDC). */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface MeResponse {
  user: {
    id: string;
    email: string | null;
    walletAddress: string | null;
    displayName: string | null;
    isArbitrationAdmin: boolean;
  };
}

export type ParticipantRole = "payee" | "payer";

export interface EscrowListItem {
  id: string;
  shortCode: string;
  title: string;
  status: EscrowStatus;
  totalAmount: string;
  createdAt: string;
  role: ParticipantRole | null;
  counterparty: string | null;
}

export interface EscrowListResponse {
  escrows: EscrowListItem[];
}

export interface CreateEscrowResponse {
  id: string;
  shortCode: string;
  url: string;
  invitationSent: boolean;
}

export interface ActivityItem {
  id: number;
  actionType: EscrowActionType;
  milestoneIndex: number | null;
  actorAddress: string | null;
  txHash: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EvidenceItem {
  id: string;
  milestoneIndex: number;
  submittedBy: string | null;
  comment: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface PrivateMilestone {
  milestoneIndex: number;
  status: MilestoneStatus;
  deliverableUrl: string | null;
  deliverableNotes: string | null;
}

export interface EscrowDetailResponse {
  role: ParticipantRole | "arbitration";
  payerEmail: string | null;
  payeeEmail: string | null;
  milestones: PrivateMilestone[];
  activity: ActivityItem[];
  evidence: EvidenceItem[];
}

export interface SyncResponse {
  checkout: PublicCheckout;
  applied: { eventName: string; logIndex: number; milestoneIndex: number | null; duplicate: boolean }[];
}

export interface DisputeItem {
  escrowId: string;
  shortCode: string;
  title: string;
  chainId: number;
  onchainEscrowId: string;
  platformFeeBps: number;
  payerAddress: string;
  payeeAddress: string;
  payerEmail: string | null;
  payeeEmail: string | null;
  milestone: {
    index: number;
    title: string;
    amount: string;
    deliverableUrl: string | null;
    deliverableNotes: string | null;
  };
  evidence: EvidenceItem[];
  openedAt: string | null;
}

export interface DisputesResponse {
  disputes: DisputeItem[];
}
