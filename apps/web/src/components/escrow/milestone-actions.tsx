"use client";

import { computeSplit, formatUsdc, type PublicCheckout, type PublicCheckoutMilestone } from "@escrow/shared";
import { ArrowUpRightIcon, Undo2Icon, UnlockIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ConfirmTxDialog,
  DeliverableDialog,
  DisputeDialog,
  EvidenceDialog,
} from "@/components/escrow/milestone-dialogs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { EscrowTransactions } from "@/hooks/use-escrow-transactions";
import type { PrivateMilestone } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export type ViewerRole = "payee" | "payer" | "arbitration" | null;

interface MilestoneActionsProps {
  checkout: PublicCheckout;
  milestone: PublicCheckoutMilestone;
  privateMilestone?: PrivateMilestone;
  role: ViewerRole;
  tx: EscrowTransactions;
  identityPending: boolean;
  providerName: string;
}

/**
 * Qué sigue en un hito para quien lo mira: una frase que explica el momento y solo las acciones que le tocan,
 * con la principal destacada.
 */
export function MilestoneActions({
  checkout,
  milestone,
  privateMilestone,
  role,
  tx,
  identityPending,
  providerName,
}: MilestoneActionsProps) {
  const onchainId = checkout.onchain_escrow_id;
  const amount = BigInt(milestone.amount);
  const feeBps = checkout.platform_fee_bps ?? 0;
  const { payeeAmount, fee } = computeSplit(amount, feeBps);
  const status = milestone.status;
  const active = status === "funded" || status === "delivered_review";
  const live = active || status === "disputed";
  const isParty = role === "payer" || role === "payee";

  if (status === "pending") return null;
  if (identityPending && live) {
    return (
      <div className="mt-4 space-y-3" aria-hidden="true">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-9 w-40" />
      </div>
    );
  }

  const deliverableLink = privateMilestone?.deliverableUrl ? (
    <Button key="deliverable-link" asChild variant="ghost" size="sm" className="group/link -ml-3">
      <a href={privateMilestone.deliverableUrl} target="_blank" rel="noopener noreferrer">
        Ver la entrega
        <ArrowUpRightIcon className="transition-transform duration-200 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
      </a>
    </Button>
  ) : null;

  let guidance: ReactNode = null;
  let yourTurn = false;
  const buttons: ReactNode[] = [];

  const releaseDialog = (primary: boolean) =>
    onchainId && (
      <ConfirmTxDialog
        key="release"
        tx={tx}
        trigger={
          <Button variant={primary ? "default" : "outline"} size={primary ? "default" : "sm"} disabled={tx.busy}>
            <UnlockIcon /> Liberar pago
          </Button>
        }
        title={`Liberar el pago de "${milestone.title}"`}
        description={`El pago sale de la garantía hacia ${providerName}. No se puede deshacer.`}
        rows={[
          { label: "Monto del hito", value: amount },
          { label: `Recibe ${providerName}`, value: payeeAmount },
          { label: "Comisión de extan", value: fee },
        ]}
        confirmLabel="Liberar pago"
        success="Pago liberado"
        run={() =>
          tx.release(onchainId, milestone.milestone_index, {
            description: `Liberas ${formatUsdc(amount)} USDC de "${milestone.title}" para ${providerName}.`,
            buttonText: "Liberar pago",
            action: "Liberar pago",
          })
        }
      />
    );

  const disputeDialog = (label: string) =>
    onchainId && (
      <DisputeDialog
        key="dispute"
        tx={tx}
        escrowId={checkout.id}
        onchainId={onchainId}
        milestone={milestone}
        triggerLabel={label}
      />
    );

  if (role === "payer") {
    if (status === "funded") {
      guidance = `Esperando la entrega de ${providerName}. Te avisaremos por email cuando llegue.`;
      buttons.push(releaseDialog(false), disputeDialog("Tengo un problema"));
    } else if (status === "delivered_review") {
      yourTurn = true;
      guidance = `${providerName} entregó este hito. Revísalo y, si está bien, libera el pago.`;
      buttons.push(deliverableLink, releaseDialog(true), disputeDialog("Tengo un problema"));
    }
  } else if (role === "payee") {
    if (status === "funded") {
      yourTurn = true;
      guidance = "El pago está en garantía. Cuando termines, envía la entrega para que tu cliente la revise.";
      buttons.push(
        <DeliverableDialog
          key="deliverable"
          escrowId={checkout.id}
          milestone={milestone}
          initialUrl={privateMilestone?.deliverableUrl ?? ""}
          initialNotes={privateMilestone?.deliverableNotes ?? ""}
        />,
      );
      if (onchainId) {
        buttons.push(
          <ConfirmTxDialog
            key="refund"
            tx={tx}
            trigger={
              <Button variant="outline" size="sm" disabled={tx.busy}>
                <Undo2Icon /> Reembolsar
              </Button>
            }
            title={`Reembolsar "${milestone.title}"`}
            description="Cancelas este hito y tu cliente recibe el 100% de vuelta, sin comisiones. No se puede deshacer."
            rows={[{ label: "Vuelve a tu cliente", value: amount }]}
            confirmLabel="Reembolsar"
            success="Hito reembolsado"
            run={() =>
              tx.refund(onchainId, milestone.milestone_index, {
                description: `Devuelves ${formatUsdc(amount)} USDC de "${milestone.title}" a tu cliente.`,
                buttonText: "Reembolsar",
                action: "Reembolsar hito",
              })
            }
          />,
        );
      }
      buttons.push(disputeDialog("Abrir disputa"));
    } else if (status === "delivered_review") {
      guidance = "Enviaste la entrega. Esperando que tu cliente la revise y libere el pago.";
      buttons.push(
        deliverableLink,
        <DeliverableDialog
          key="deliverable"
          escrowId={checkout.id}
          milestone={milestone}
          initialUrl={privateMilestone?.deliverableUrl ?? ""}
          initialNotes={privateMilestone?.deliverableNotes ?? ""}
        />,
        disputeDialog("Abrir disputa"),
      );
    }
  }

  if (status === "disputed") {
    if (isParty) {
      guidance =
        "El dinero de este hito está congelado. Un árbitro revisará lo que cuenten ambas partes y decidirá cómo repartirlo.";
      buttons.push(<EvidenceDialog key="evidence" escrowId={checkout.id} milestone={milestone} />);
    } else if (role === "arbitration") {
      guidance = "Disputa abierta: revisa la evidencia y resuélvela desde el panel.";
      buttons.push(
        <Button key="arbitration" asChild size="sm">
          <Link href="/arbitration">Ir al panel de arbitraje</Link>
        </Button>,
      );
    }
  }

  // Hitos cerrados: el estado y el comprobante ya están en la fila. Solo se agrega lo que no dicen: cuánto recibió
  // el proveedor después de la comisión.
  if (status === "released" && role === "payee") {
    guidance = `Recibiste ${formatUsdc(payeeAmount)} USDC después de la comisión.`;
  }

  const visibleButtons = buttons.filter(Boolean);
  if (!guidance && visibleButtons.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {guidance && (
        <p className={cn("text-[0.9375rem]", yourTurn ? "text-foreground" : "text-muted-foreground")}>{guidance}</p>
      )}
      {visibleButtons.length > 0 && <div className="flex flex-wrap items-center gap-2">{visibleButtons}</div>}
    </div>
  );
}
