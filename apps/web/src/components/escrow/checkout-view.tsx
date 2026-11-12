"use client";

import type { PublicCheckout } from "@escrow/shared";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { PasskeyPrompt } from "@/components/auth/passkey-prompt";
import { Avatar } from "@/components/avatar";
import { ActivityTimeline } from "@/components/escrow/activity-timeline";
import { AmountBar } from "@/components/escrow/amount-bar";
import { CheckoutSummary } from "@/components/escrow/checkout-summary";
import { MilestoneActions, type ViewerRole } from "@/components/escrow/milestone-actions";
import { MilestoneTrack } from "@/components/escrow/milestone-track";
import { apiFetch, ApiClientError, useApi } from "@/hooks/use-api";
import { readPendingSync, syncTransaction, useEscrowTransactions } from "@/hooks/use-escrow-transactions";
import { useMe } from "@/hooks/use-me";
import type { EscrowDetailResponse } from "@/lib/api-types";

/**
 * Link público de cobro. El estado del acuerdo (datos públicos) se muestra de inmediato; solo las acciones esperan
 * a saber quién mira. En móvil el resumen con la acción principal va antes que los hitos.
 */
export function CheckoutView({ initial }: { initial: PublicCheckout }) {
  const escrowId = initial.id;
  const queryClient = useQueryClient();
  const api = useApi();
  const { ready, authenticated } = usePrivy();
  const { data: me, isPending: mePending } = useMe();
  const tx = useEscrowTransactions(escrowId);

  const { data: checkout = initial } = useQuery({
    queryKey: ["checkout", escrowId],
    queryFn: () => apiFetch<PublicCheckout>(`/api/checkout/${escrowId}`),
    initialData: initial,
    refetchInterval: (query) => (query.state.data?.status === "completed" || query.state.data?.status === "cancelled" ? false : 15_000),
  });

  const { data: detail, isPending: detailPending } = useQuery({
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

  // Mientras Privy arranca o se identifica al usuario, las zonas de acción muestran un esqueleto.
  const identityPending = !ready || (authenticated && (mePending || (!!me && detailPending)));

  const privateByIndex = new Map(detail?.milestones.map((m) => [m.milestoneIndex, m]));
  const milestoneTitles = new Map(checkout.milestones.map((m) => [m.milestone_index, m.title]));
  const providerName = checkout.provider_display_name ?? "Tu proveedor";
  const isDraft = checkout.status === "draft";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <div className="grid grid-cols-1 gap-x-16 gap-y-10 [grid-template-areas:'head'_'summary'_'body'] lg:grid-cols-[minmax(0,1fr)_23.5rem] lg:[grid-template-areas:'head_summary'_'body_summary']">
        <header className="min-w-0 space-y-5 [grid-area:head]">
          <div className="flex items-center gap-3">
            <Avatar name={providerName} />
            <p className="text-sm text-muted-foreground">
              {role === "payee" ? (
                "Tu link de cobro"
              ) : (
                <>
                  <span className="font-medium text-foreground">{providerName}</span> te envió un acuerdo de pago
                </>
              )}
            </p>
          </div>
          <div className="space-y-3">
            <h1>{checkout.title}</h1>
            {checkout.description && (
              <p className="max-w-prose text-[1.0625rem] whitespace-pre-line text-muted-foreground">{checkout.description}</p>
            )}
          </div>
          {!isDraft && (
            <AmountBar
              className="pt-2"
              segments={checkout.milestones.map((m) => ({ amount: m.amount, status: m.status, title: m.title }))}
            />
          )}
        </header>

        <aside className="space-y-4 [grid-area:summary] lg:sticky lg:top-24 lg:self-start">
          <CheckoutSummary
            checkout={checkout}
            role={role}
            tx={tx}
            identityPending={identityPending}
            providerName={providerName}
          />
          <PasskeyPrompt />
        </aside>

        <div className="min-w-0 space-y-14 [grid-area:body]">
          <section aria-labelledby="milestones-heading" className="space-y-7">
            <div className="space-y-1">
              <h2 id="milestones-heading">{checkout.milestones.length === 1 ? "Un hito" : `${checkout.milestones.length} hitos`}</h2>
              <p className="text-muted-foreground">
                {role === "payee"
                  ? "Cobras cada hito cuando tu cliente aprueba la entrega."
                  : "Cada hito se paga por separado, cuando apruebas su entrega."}
              </p>
            </div>
            <MilestoneTrack
              milestones={checkout.milestones}
              chainId={checkout.chain_id}
              renderExtra={(index) => {
                const milestone = checkout.milestones[index];
                if (!milestone) return null;
                return (
                  <MilestoneActions
                    checkout={checkout}
                    milestone={milestone}
                    privateMilestone={privateByIndex.get(milestone.milestone_index)}
                    role={role}
                    tx={tx}
                    identityPending={identityPending}
                    providerName={providerName}
                  />
                );
              }}
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
      </div>
    </div>
  );
}
