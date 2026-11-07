import type { Address, Hex } from "viem";
import type { EscrowStatus, MilestoneStatus } from "./status";

/** Forma del JSON que devuelve `public.get_public_checkout()` (montos como string para no perder precisión). */
export interface PublicCheckoutMilestone {
  id: string;
  milestone_index: number;
  title: string;
  description: string | null;
  amount: string;
  due_date: string | null;
  status: MilestoneStatus;
  has_deliverable: boolean;
  tx_hash_settled: Hex | null;
}

export interface PublicCheckout {
  id: string;
  short_code: string;
  title: string;
  description: string | null;
  status: EscrowStatus;
  chain_id: number;
  contract_address: Address | null;
  onchain_escrow_id: string | null;
  tx_hash_funded: Hex | null;
  platform_fee_bps: number | null;
  total_amount: string;
  payer_address: Address | null;
  payee_address: Address;
  provider_display_name: string | null;
  created_at: string;
  milestones: PublicCheckoutMilestone[];
}
