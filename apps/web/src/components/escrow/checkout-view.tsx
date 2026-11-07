"use client";

import type { PublicCheckout } from "@escrow/shared";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { PasskeyPrompt } from "@/components/auth/passkey-prompt";
import { ActivityTimeline } from "@/components/escrow/activity-timeline";
import { AmountBar } from "@/components/escrow/amount-bar";
import { FundPanel } from "@/components/escrow/fund-panel";
import { MilestoneActions, type ViewerRole } from "@/components/escrow/milestone-actions";
import { MilestoneTrack } from "@/components/escrow/milestone-track";
import { apiFetch, ApiClientError, useApi } from "@/hooks/use-api";
import { readPendingSync, syncTransaction, useEscrowTransactions } from "@/hooks/use-escrow-transactions";
import { useMe } from "@/hooks/use-me";
import type { EscrowDetailResponse } from "@/lib/api-types";

/** Link público de cobro (estilo Stripe Checkout): estado en vivo + acción contextual según quién lo mira. */
export function CheckoutView({ initial }: { initial: PublicCheckout }) {
  const escrowId = initial.id;
  const queryClient = useQueryClient();
  const api = useApi();
  const { authenticated } = usePrivy();
  const { data: me } = useMe();
  const tx = useEscrowTransactions(escrowId);

  const { data: checkout = initial } = useQuery({
    queryKey: ["checkout", escrowId],
    queryFn: () => apiFetch<PublicCheckout>(`/api/checkout/${escrowId}`),
    initialData: initial,
    refetchInterval: (query) => (query.state.data?.status === "completed" || query.state.data?.status === "cancelled" ? false : 15_000),
  });

  const { data: detail } = useQuery({
    queryKey: ["escrow-detail", escrowId, me?.id],
    queryFn: async () => {
      try {
        return await api<EscrowDetailResponse>(`/api/escrows/${escrowId}`);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 403) return null;
        throw error;
      }
    },
    enabled: authenticated && !!me,
    retry: false,
  });

  // Reintenta una reconciliación pendiente (p. ej. si se cerró la pestaña tras confirmar on-chain).
  useEffect(() => {
    const pending = readPendingSync(escrowId);
    if (!pending) return;
    syncTransaction(escrowId, pending)
      .then((result) => queryClient.setQueryData(["checkout", escrowId], result.checkout))
      .catch(() => undefined);
  }, [escrowId, queryClient]);

  const role: ViewerRole = useMemo(() => {
    if (detail?.role) return detail.role;
    const wallet = me?.walletAddress;
    if (!wallet) return null;
    if (wallet === checkout.payee_address) return "payee";
    if (wallet === checkout.payer_address) return "payer";
    return null;
  }, [checkout.payee_address, checkout.payer_address, detail?.role, me?.walletAddress]);

  const privateByIndex = new Map(detail?.milestones.map((m) => [m.milestoneIndex, m]));
  const milestoneTitles = new Map(checkout.milestones.map((m) => [m.milestone_index, m.title]));
  const provider = checkout.provider_display_name ?? "Tu proveedor";

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-12">
      <div className="min-w-0 space-y-10">
        <header className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {role === "payee" ? "Tu link de cobro" : `${provider} te envió un acuerdo de pago`}
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">{checkout.title}</h1>
          {checkout.description && <p className="max-w-prose whitespace-pre-line text-muted-foreground">{checkout.description}</p>}
          <AmountBar
            className="pt-2"
            segments={checkout.milestones.map((m) => ({ amount: m.amount, status: m.status, title: m.title }))}
          />
        </header>

        <section aria-labelledby="milestones-heading" className="space-y-6">
          <h2 id="milestones-heading" className="text-xl font-semibold">
            {checkout.milestones.length === 1 ? "Hito" : `${checkout.milestones.length} hitos`}
          </h2>
          <MilestoneTrack
            milestones={checkout.milestones}
            renderExtra={(milestone) => (
              <MilestoneActions
                checkout={checkout}
                milestone={milestone}
                privateMilestone={privateByIndex.get(milestone.milestone_index)}
                role={role}
                tx={tx}
              />
            )}
          />
        </section>

        {detail && detail.activity.length > 0 && (
          <ActivityTimeline
            chainId={checkout.chain_id}
            activity={detail.activity}
            evidence={detail.evidence}
            milestoneTitles={milestoneTitles}
          />
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <FundPanel checkout={checkout} role={role} tx={tx} />
        <PasskeyPrompt />
      </aside>
    </div>
  );
}
