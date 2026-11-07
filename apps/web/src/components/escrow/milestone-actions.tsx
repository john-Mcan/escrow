"use client";

import { computeSplit, formatUsdc, type PublicCheckout, type PublicCheckoutMilestone } from "@escrow/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, FileUpIcon, FlagIcon, Loader2Icon, MessageSquarePlusIcon, Undo2Icon, UnlockIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { TxLink } from "@/components/escrow/tx-link";
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
import type { useEscrowTransactions } from "@/hooks/use-escrow-transactions";
import type { PrivateMilestone } from "@/lib/api-types";
import { describeTxError, TX_STEP_LABELS } from "@/lib/tx-errors";

type Transactions = ReturnType<typeof useEscrowTransactions>;
export type ViewerRole = "payee" | "payer" | "arbitration" | null;

interface MilestoneActionsProps {
  checkout: PublicCheckout;
  milestone: PublicCheckoutMilestone;
  privateMilestone?: PrivateMilestone;
  role: ViewerRole;
  tx: Transactions;
}

/** Acciones contextuales de un hito según el rol de quien mira y el estado del dinero. */
export function MilestoneActions({ checkout, milestone, privateMilestone, role, tx }: MilestoneActionsProps) {
  const onchainId = checkout.onchain_escrow_id;
  const amount = BigInt(milestone.amount);
  const feeBps = checkout.platform_fee_bps ?? 0;
  const active = milestone.status === "funded" || milestone.status === "delivered_review";
  const isParty = role === "payer" || role === "payee";

  const runTx = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(describeTxError(error));
      return false;
    }
  };

  const deliverable = privateMilestone?.deliverableUrl ? (
    <a
      href={privateMilestone.deliverableUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-vault underline-offset-4 hover:underline"
    >
      Ver entregable <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
    </a>
  ) : null;

  const buttons: ReactNode[] = [];

  if (onchainId && active && role === "payer") {
    const { payeeAmount, fee } = computeSplit(amount, feeBps);
    buttons.push(
      <ConfirmDialog
        key="release"
        trigger={
          <Button disabled={tx.busy}>
            <UnlockIcon /> Liberar fondos
          </Button>
        }
        title={`Liberar "${milestone.title}"`}
        description="El pago sale del contrato hacia el proveedor en esta misma transacción. No se puede deshacer."
        rows={[
          { label: "Monto del hito", value: `${formatUsdc(amount)} USDC` },
          { label: "Recibe el proveedor", value: `${formatUsdc(payeeAmount)} USDC` },
          { label: "Comisión de la plataforma", value: `${formatUsdc(fee)} USDC` },
        ]}
        confirmLabel="Liberar fondos"
        busyLabel={TX_STEP_LABELS[tx.step]}
        onConfirm={() => runTx(() => tx.release(onchainId, milestone.milestone_index), "Fondos liberados")}
      />,
    );
  }

  if (onchainId && role === "payee" && active) {
    buttons.push(
      <DeliverableDialog
        key="deliverable"
        escrowId={checkout.id}
        milestone={milestone}
        initialUrl={privateMilestone?.deliverableUrl ?? ""}
        initialNotes={privateMilestone?.deliverableNotes ?? ""}
      />,
    );
  }

  if (onchainId && role === "payee" && milestone.status === "funded") {
    buttons.push(
      <ConfirmDialog
        key="refund"
        trigger={
          <Button variant="outline" disabled={tx.busy}>
            <Undo2Icon /> Reembolsar
          </Button>
        }
        title={`Reembolsar "${milestone.title}"`}
        description="Cancelas este hito y tu cliente recibe el 100% de vuelta, sin comisiones."
        rows={[{ label: "Vuelve al cliente", value: `${formatUsdc(amount)} USDC` }]}
        confirmLabel="Reembolsar hito"
        busyLabel={TX_STEP_LABELS[tx.step]}
        onConfirm={() => runTx(() => tx.refund(onchainId, milestone.milestone_index), "Hito reembolsado")}
      />,
    );
  }

  if (onchainId && active && isParty) {
    buttons.push(
      <ConfirmDialog
        key="dispute"
        trigger={
          <Button variant="ghost" className="text-caution hover:text-caution" disabled={tx.busy}>
            <FlagIcon /> Abrir disputa
          </Button>
        }
        title="Abrir una disputa"
        description="Los fondos de este hito se congelan y solo el árbitro de la plataforma podrá repartirlos. Úsalo si no logran un acuerdo directo."
        rows={[{ label: "Monto congelado", value: `${formatUsdc(amount)} USDC` }]}
        confirmLabel="Abrir disputa"
        destructive
        busyLabel={TX_STEP_LABELS[tx.step]}
        onConfirm={() => runTx(() => tx.dispute(onchainId, milestone.milestone_index), "Disputa abierta. Aporta tu evidencia.")}
      />,
    );
  }

  if (milestone.status === "disputed" && isParty) {
    buttons.push(<EvidenceDialog key="evidence" escrowId={checkout.id} milestone={milestone} />);
  }

  if (!deliverable && buttons.length === 0 && !milestone.tx_hash_settled) return null;

  return (
    <div className="mt-4 space-y-3">
      {(deliverable || milestone.tx_hash_settled) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {deliverable}
          {milestone.tx_hash_settled && (
            <span className="text-muted-foreground">
              Recibo: <TxLink chainId={checkout.chain_id} hash={milestone.tx_hash_settled} label="ver en Basescan" />
            </span>
          )}
        </div>
      )}
      {buttons.length > 0 && <div className="flex flex-wrap gap-2">{buttons}</div>}
    </div>
  );
}

function ConfirmDialog({
  trigger,
  title,
  description,
  rows,
  confirmLabel,
  busyLabel,
  destructive,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  rows: { label: string; value: string }[];
  confirmLabel: string;
  busyLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border rounded-lg border">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="amount font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Volver
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const ok = await onConfirm();
              setPending(false);
              if (ok) setOpen(false);
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            {pending ? busyLabel || "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
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
      toast.success("Entregable enviado. Avisamos a tu cliente por email.");
      setOpen(false);
    } catch (error) {
      toast.error(describeTxError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isUpdate ? "outline" : "default"}>
          <FileUpIcon /> {isUpdate ? "Actualizar entregable" : "Subir entregable"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Entregable de &quot;{milestone.title}&quot;</DialogTitle>
            <DialogDescription>
              Comparte el enlace al trabajo (Drive, Figma, GitHub, etc.). Tu cliente recibirá un email para revisarlo y
              liberar los fondos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="deliverable-url">Enlace https</Label>
            <Input id="deliverable-url" name="url" type="url" required defaultValue={initialUrl} placeholder="https://" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliverable-notes">Notas para tu cliente (opcional)</Label>
            <Textarea id="deliverable-notes" name="notes" maxLength={5000} defaultValue={initialNotes} rows={4} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Enviar entregable
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
      toast.success("Evidencia enviada al árbitro.");
      setOpen(false);
    } catch (error) {
      toast.error(describeTxError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquarePlusIcon /> Aportar evidencia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Evidencia para el árbitro</DialogTitle>
            <DialogDescription>
              Explica qué pasó con &quot;{milestone.title}&quot;. Lo que envíes queda registrado y no se puede editar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="evidence-comment">Tu versión de los hechos</Label>
            <Textarea id="evidence-comment" name="comment" required maxLength={5000} rows={5} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evidence-url">Enlace a archivos (opcional)</Label>
            <Input id="evidence-url" name="attachmentUrl" type="url" placeholder="https://" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Enviar evidencia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
