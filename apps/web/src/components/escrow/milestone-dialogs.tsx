"use client";

import { formatUsdc, type PublicCheckoutMilestone } from "@escrow/shared";
import { useQueryClient } from "@tanstack/react-query";
import { FlagIcon, MessageSquarePlusIcon, SendIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { DetailRow } from "@/components/disclosure";
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
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import type { EscrowTransactions } from "@/hooks/use-escrow-transactions";
import { describeTxError } from "@/lib/tx-errors";

/** Confirmación de una operación con dinero: resumen antes de firmar y avance paso a paso mientras se procesa. */
export function ConfirmTxDialog({
  tx,
  trigger,
  title,
  description,
  rows,
  confirmLabel,
  success,
  run,
}: {
  tx: EscrowTransactions;
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
export function DisputeDialog({
  tx,
  escrowId,
  onchainId,
  milestone,
  triggerLabel,
}: {
  tx: EscrowTransactions;
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
              <p className="text-sm text-muted-foreground">
                Queda registrado y no se puede editar. Podrás agregar más después.
              </p>
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

/** El proveedor envía (o actualiza) el enlace a la entrega; el cliente recibe un email para revisarla. */
export function DeliverableDialog({
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
      toast.success(
        isUpdate ? "Entrega actualizada. Avisamos a tu cliente." : "Entrega enviada. Avisamos a tu cliente por email.",
      );
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

/** Durante una disputa, cada parte puede sumar a su versión. La evidencia es append-only. */
export function EvidenceDialog({ escrowId, milestone }: { escrowId: string; milestone: PublicCheckoutMilestone }) {
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

/** Error dentro de un diálogo, junto a la acción que falló. */
function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
    >
      {children}
    </p>
  );
}
