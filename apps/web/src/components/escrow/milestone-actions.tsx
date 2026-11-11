"use client";

import { computeSplit, formatUsdc, type PublicCheckout, type PublicCheckoutMilestone } from "@escrow/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRightIcon, FlagIcon, MessageSquarePlusIcon, SendIcon, Undo2Icon, UnlockIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { DetailRow } from "@/components/disclosure";
import { TxLink } from "@/components/escrow/tx-link";
import { SINGLE_TX_STEPS, toProgress, TxProgress } from "@/components/escrow/tx-progress";
import { ProgressSteps, Spinner, WorkLine } from "@/components/loaders";
import { Usdc } from "@/components/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import type { useEscrowTransactions } from "@/hooks/use-escrow-transactions";
import type { PrivateMilestone } from "@/lib/api-types";
import { describeTxError } from "@/lib/tx-errors";
import { cn } from "@/lib/utils";

type Transactions = ReturnType<typeof useEscrowTransactions>;
export type ViewerRole = "payee" | "payer" | "arbitration" | null;

interface MilestoneActionsProps {
  checkout: PublicCheckout;
  milestone: PublicCheckoutMilestone;
  privateMilestone?: PrivateMilestone;
  role: ViewerRole;
  tx: Transactions;
  identityPending: boolean;
  providerName: string;
}

/**
 * Qué sigue en un hito para quien lo mira: una frase que explica el momento y solo las acciones que le tocan,
 * con la principal destacada.
 */
export function MilestoneActions({ checkout, milestone, privateMilestone, role, tx, identityPending, providerName }: MilestoneActionsProps) {
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

  const receipt = milestone.tx_hash_settled ? (
    <TxLink chainId={checkout.chain_id} hash={milestone.tx_hash_settled} label="Ver comprobante" className="text-sm" />
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
      guidance = "El dinero de este hito está congelado. Un árbitro revisará lo que cuenten ambas partes y decidirá cómo repartirlo.";
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

  if (status === "released") {
    guidance = role === "payee" ? `Recibiste ${formatUsdc(payeeAmount)} USDC.` : isParty ? `Pago liberado a ${providerName}.` : null;
  } else if (status === "refunded") {
    guidance = role === "payee" ? "Devolviste este hito a tu cliente." : role === "payer" ? "Te devolvieron el monto completo." : null;
  } else if (status === "resolved") {
    guidance = isParty ? "El árbitro resolvió la disputa y repartió este hito." : null;
  }

  const visibleButtons = buttons.filter(Boolean);
  if (!guidance && visibleButtons.length === 0 && !receipt) return null;

  return (
    <div className="mt-4 space-y-3">
      {(guidance || receipt) && (
        <p className={cn("text-[0.9375rem]", yourTurn ? "text-foreground" : "text-muted-foreground")}>
          {guidance} {receipt}
        </p>
      )}
      {visibleButtons.length > 0 && <div className="flex flex-wrap items-center gap-2">{visibleButtons}</div>}
    </div>
  );
}

/** Confirmación de una operación con dinero: resumen antes de firmar y avance paso a paso mientras se procesa. */
function ConfirmTxDialog({
  tx,
  trigger,
  title,
  description,
  rows,
  confirmLabel,
  success,
  run,
}: {
  tx: Transactions;
  trigger: ReactNode;
  title: string;
  description: string;
  rows: { label: string; value: bigint }[];
  confirmLabel: string;
  success: string;
  run: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await run();
      toast.success(success);
      setOpen(false);
    } catch (failure) {
      setError(describeTxError(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        {pending && <WorkLine active className="absolute inset-x-0 top-0 rounded-t-2xl" />}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {pending ? (
          <TxProgress defs={SINGLE_TX_STEPS} step={tx.step} />
        ) : (
          <>
            <dl className="divide-y divide-border border-y border-border text-[0.9375rem]">
              {rows.map((row) => (
                <DetailRow key={row.label} label={row.label} className="py-3">
                  <Usdc amount={row.value} className="font-semibold" />
                </DetailRow>
              ))}
            </dl>
            {error && <ErrorNote>{error}</ErrorNote>}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Volver</Button>
              </DialogClose>
              <Button onClick={confirm}>{error ? "Intentar de nuevo" : confirmLabel}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const DISPUTE_EXTRA_STEP = "Enviamos tu versión al árbitro";

/**
 * Disputa en un solo flujo: la versión de los hechos se escribe antes de firmar y se envía sola cuando la disputa
 * queda confirmada. El texto se conserva si la firma se cancela o falla.
 */
function DisputeDialog({
  tx,
  escrowId,
  onchainId,
  milestone,
  triggerLabel,
}: {
  tx: Transactions;
  escrowId: string;
  onchainId: string;
  milestone: PublicCheckoutMilestone;
  triggerLabel: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"form" | "chain" | "evidence" | "retry">("form");
  const [comment, setComment] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = phase === "chain" || phase === "evidence";
  const amount = BigInt(milestone.amount);

  async function sendEvidence() {
    setPhase("evidence");
    try {
      await api(`/api/escrows/${escrowId}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          milestoneIndex: milestone.milestone_index,
          comment: comment.trim(),
          attachmentUrl: attachmentUrl.trim() || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["escrow-detail", escrowId] });
      toast.success("Disputa abierta. El árbitro ya tiene tu versión.");
      setOpen(false);
      setPhase("form");
      setComment("");
      setAttachmentUrl("");
    } catch (failure) {
      setError(describeTxError(failure));
      setPhase("retry");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPhase("chain");
    try {
      await tx.dispute(onchainId, milestone.milestone_index, {
        description: `Congelas ${formatUsdc(amount)} USDC de "${milestone.title}" hasta que el árbitro decida.`,
        buttonText: "Abrir disputa",
        action: "Abrir disputa",
      });
    } catch (failure) {
      setError(describeTxError(failure));
      setPhase("form");
      return;
    }
    await sendEvidence();
  }

  const steps = [
    ...toProgress(SINGLE_TX_STEPS, tx.step, phase === "evidence" || phase === "retry"),
    { label: DISPUTE_EXTRA_STEP, state: phase === "evidence" ? ("active" as const) : ("pending" as const) },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="caution" size="sm" disabled={tx.busy}>
          <FlagIcon /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!busy}>
        {busy && <WorkLine active className="absolute inset-x-0 top-0 rounded-t-2xl" />}
        <DialogHeader>
          <DialogTitle>Abrir una disputa</DialogTitle>
          <DialogDescription>
            Si no lo resuelven conversando, el dinero de &quot;{milestone.title}&quot; queda congelado y un árbitro
            independiente decide cómo repartirlo.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <ProgressSteps steps={steps} />
        ) : phase === "retry" ? (
          <>
            <ErrorNote>La disputa quedó abierta, pero no pudimos enviar tu versión: {error}</ErrorNote>
            <DialogFooter>
              <Button onClick={() => void sendEvidence()}>Reintentar envío</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`dispute-${milestone.id}`}>¿Qué pasó?</Label>
              <Textarea
                id={`dispute-${milestone.id}`}
                required
                maxLength={5000}
                rows={4}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Cuéntale al árbitro qué se acordó y qué falta o no se cumplió."
              />
              <p className="text-sm text-muted-foreground">Queda registrado y no se puede editar. Podrás agregar más después.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`dispute-url-${milestone.id}`}>Enlace a pruebas (opcional)</Label>
              <Input
                id={`dispute-url-${milestone.id}`}
                type="url"
                value={attachmentUrl}
                onChange={(event) => setAttachmentUrl(event.target.value)}
                placeholder="https://drive.google.com/…"
              />
            </div>
            <dl className="border-y border-border text-[0.9375rem]">
              <DetailRow label="Monto que se congela" className="py-3">
                <Usdc amount={amount} className="font-semibold" />
              </DetailRow>
            </dl>
            {error && <ErrorNote>{error}</ErrorNote>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Volver
                </Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={!comment.trim()}>
                <FlagIcon /> Abrir disputa
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeliverableDialog({
  escrowId,
  milestone,
  initialUrl,
  initialNotes,
}: {
  escrowId: string;
  milestone: PublicCheckoutMilestone;
  initialUrl: string;
  initialNotes: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isUpdate = milestone.status === "delivered_review";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api(`/api/escrows/${escrowId}/milestones/${milestone.milestone_index}/deliverable`, {
        method: "POST",
        body: JSON.stringify({ url: form.get("url"), notes: form.get("notes") || undefined }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["checkout", escrowId] }),
        queryClient.invalidateQueries({ queryKey: ["escrow-detail", escrowId] }),
      ]);
      toast.success(isUpdate ? "Entrega actualizada. Avisamos a tu cliente." : "Entrega enviada. Avisamos a tu cliente por email.");
      setOpen(false);
    } catch (error) {
      toast.error(describeTxError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant={isUpdate ? "outline" : "default"} size={isUpdate ? "sm" : "default"}>
          <SendIcon /> {isUpdate ? "Actualizar entrega" : "Enviar entrega"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {pending && <WorkLine active className="absolute inset-x-0 top-0 rounded-t-2xl" />}
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{isUpdate ? "Actualizar la entrega" : "Enviar la entrega"}</DialogTitle>
            <DialogDescription>
              Comparte el enlace al trabajo de &quot;{milestone.title}&quot; (Drive, Figma, GitHub u otro). Tu cliente
              recibirá un email para revisarlo y liberar el pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`deliverable-url-${milestone.id}`}>Enlace a la entrega</Label>
            <Input
              id={`deliverable-url-${milestone.id}`}
              name="url"
              type="url"
              required
              defaultValue={initialUrl}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`deliverable-notes-${milestone.id}`}>Mensaje para tu cliente (opcional)</Label>
            <Textarea
              id={`deliverable-notes-${milestone.id}`}
              name="notes"
              maxLength={5000}
              defaultValue={initialNotes}
              rows={3}
              placeholder="Qué incluye, cómo revisarlo, accesos…"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Volver
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : <SendIcon />}
              {pending ? "Enviando…" : isUpdate ? "Actualizar entrega" : "Enviar entrega"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceDialog({ escrowId, milestone }: { escrowId: string; milestone: PublicCheckoutMilestone }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api(`/api/escrows/${escrowId}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          milestoneIndex: milestone.milestone_index,
          comment: form.get("comment"),
          attachmentUrl: form.get("attachmentUrl") || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["escrow-detail", escrowId] });
      toast.success("Enviado al árbitro.");
      setOpen(false);
    } catch (error) {
      toast.error(describeTxError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquarePlusIcon /> Agregar a tu versión
        </Button>
      </DialogTrigger>
      <DialogContent>
        {pending && <WorkLine active className="absolute inset-x-0 top-0 rounded-t-2xl" />}
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Tu versión para el árbitro</DialogTitle>
            <DialogDescription>
              Suma lo que ayude a decidir sobre &quot;{milestone.title}&quot;. Queda registrado y no se puede editar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`evidence-${milestone.id}`}>Lo que quieres agregar</Label>
            <Textarea id={`evidence-${milestone.id}`} name="comment" required maxLength={5000} rows={5} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`evidence-url-${milestone.id}`}>Enlace a pruebas (opcional)</Label>
            <Input id={`evidence-url-${milestone.id}`} name="attachmentUrl" type="url" placeholder="https://" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Volver
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Enviando…" : "Enviar al árbitro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
      {children}
    </p>
  );
}
