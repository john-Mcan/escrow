"use client";

import {
  computeSplit,
  createEscrowSchema,
  DEFAULT_MAX_ESCROW_AMOUNT,
  formatBps,
  formatUsdc,
  MAX_MILESTONES,
  milestoneEscrowAbi,
  USDC_INPUT_PATTERN,
  parseUsdc,
} from "@escrow/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useReadContract } from "wagmi";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import type { CreateEscrowResponse } from "@/lib/api-types";
import { appChain, escrowContractAddress } from "@/lib/env";
import { describeTxError } from "@/lib/tx-errors";
import { cn } from "@/lib/utils";

interface MilestoneDraft {
  key: number;
  title: string;
  description: string;
  amount: string;
  dueDate: string;
}

let nextKey = 1;
const emptyMilestone = (): MilestoneDraft => ({ key: nextKey++, title: "", description: "", amount: "", dueDate: "" });

function safeAmount(value: string): bigint {
  return USDC_INPUT_PATTERN.test(value.trim()) ? parseUsdc(value) : 0n;
}

export function CreateEscrowForm() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(() => [emptyMilestone()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<CreateEscrowResponse | null>(null);

  const { data: feeBps } = useReadContract({
    address: escrowContractAddress,
    abi: milestoneEscrowAbi,
    functionName: "platformFeeBps",
    chainId: appChain.id,
  });

  const total = milestones.reduce((sum, m) => sum + safeAmount(m.amount), 0n);
  const preview = feeBps !== undefined ? computeSplit(total, feeBps) : null;

  const update = (key: number, patch: Partial<MilestoneDraft>) =>
    setMilestones((current) => current.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      payerEmail: String(form.get("payerEmail") ?? "").trim() || undefined,
      milestones: milestones.map((m) => ({
        title: m.title,
        description: m.description || undefined,
        amount: m.amount,
        dueDate: m.dueDate || undefined,
      })),
    };

    const parsed = createEscrowSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        next[path] ??= issue.message;
      }
      setErrors(next);
      toast.error("Revisa los campos marcados.");
      return;
    }

    setErrors({});
    setPending(true);
    try {
      const result = await api<CreateEscrowResponse>("/api/escrows", { method: "POST", body: JSON.stringify(input) });
      await queryClient.invalidateQueries({ queryKey: ["escrows"] });
      setCreated(result);
    } catch (error) {
      toast.error(describeTxError(error));
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-6">
        <h1 className="text-3xl font-bold">Tu link de cobro está listo</h1>
        <p className="text-muted-foreground">
          {created.invitationSent
            ? "Le enviamos la invitación a tu cliente. También puedes compartir el link por WhatsApp o donde prefieras."
            : "Compártelo con tu cliente por WhatsApp, email o donde prefieras."}{" "}
          Te avisaremos por email cuando deposite.
        </p>
        <div className="flex gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border bg-card px-3 py-2.5 text-sm">{created.url}</code>
          <CopyButton value={created.url} className="h-auto" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" className="h-10 px-4">
            <Link href={`/pay/${created.shortCode}`}>Ver el link</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-10 px-4">
            <Link href="/dashboard">Volver a mis acuerdos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-8">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="size-4" /> Mis acuerdos
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Nuevo link de cobro</h1>
          <p className="mt-1 text-muted-foreground">Divide el trabajo en hitos. Cobras cada uno cuando tu cliente lo aprueba.</p>
        </div>

        <fieldset className="space-y-4">
          <Field label="Título del acuerdo" error={errors.title} htmlFor="title">
            <Input id="title" name="title" maxLength={140} placeholder="Rediseño del sitio web" aria-invalid={!!errors.title} />
          </Field>
          <Field label="Descripción (opcional)" htmlFor="description" error={errors.description}>
            <Textarea id="description" name="description" maxLength={5000} rows={3} placeholder="Alcance, entregables y condiciones." />
          </Field>
          <Field
            label="Email de tu cliente (opcional)"
            htmlFor="payerEmail"
            error={errors.payerEmail}
            hint="Le enviaremos el link de pago y le avisaremos de cada entrega."
          >
            <Input id="payerEmail" name="payerEmail" type="email" autoComplete="off" placeholder="cliente@empresa.com" aria-invalid={!!errors.payerEmail} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-heading text-xl font-semibold">Hitos</legend>
          {errors.milestones && <p className="text-sm text-destructive">{errors.milestones}</p>}
          <ol className="space-y-4">
            {milestones.map((milestone, index) => (
              <li key={milestone.key} className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Hito {index + 1}</span>
                  {milestones.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMilestones((current) => current.filter((m) => m.key !== milestone.key))}
                    >
                      <Trash2Icon /> Quitar
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <Field label="Qué entregas" htmlFor={`m-${milestone.key}-title`} error={errors[`milestones.${index}.title`]}>
                    <Input
                      id={`m-${milestone.key}-title`}
                      value={milestone.title}
                      maxLength={140}
                      placeholder="Diseño de la página principal"
                      onChange={(e) => update(milestone.key, { title: e.target.value })}
                      aria-invalid={!!errors[`milestones.${index}.title`]}
                    />
                  </Field>
                  <Field label="Monto (USDC)" htmlFor={`m-${milestone.key}-amount`} error={errors[`milestones.${index}.amount`]}>
                    <Input
                      id={`m-${milestone.key}-amount`}
                      value={milestone.amount}
                      inputMode="decimal"
                      placeholder="1500.00"
                      className="amount text-right"
                      onChange={(e) => update(milestone.key, { amount: e.target.value })}
                      aria-invalid={!!errors[`milestones.${index}.amount`]}
                    />
                  </Field>
                  <Field label="Detalle (opcional)" htmlFor={`m-${milestone.key}-description`}>
                    <Textarea
                      id={`m-${milestone.key}-description`}
                      value={milestone.description}
                      maxLength={5000}
                      rows={2}
                      onChange={(e) => update(milestone.key, { description: e.target.value })}
                    />
                  </Field>
                  <Field label="Entrega estimada" htmlFor={`m-${milestone.key}-due`} error={errors[`milestones.${index}.dueDate`]}>
                    <Input
                      id={`m-${milestone.key}-due`}
                      type="date"
                      value={milestone.dueDate}
                      onChange={(e) => update(milestone.key, { dueDate: e.target.value })}
                    />
                  </Field>
                </div>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            disabled={milestones.length >= MAX_MILESTONES}
            onClick={() => setMilestones((current) => [...current, emptyMilestone()])}
          >
            <PlusIcon /> Agregar hito
          </Button>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <p className="text-sm text-muted-foreground">Tu cliente deposita</p>
            <p className={cn("amount font-heading text-3xl font-bold", total > DEFAULT_MAX_ESCROW_AMOUNT && "text-destructive")}>
              {formatUsdc(total)} <span className="text-base font-medium text-muted-foreground">USDC</span>
            </p>
          </div>
          {preview && (
            <dl className="space-y-1.5 border-t pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Comisión ({formatBps(Number(feeBps))})</dt>
                <dd className="amount">−{formatUsdc(preview.fee)}</dd>
              </div>
              <div className="flex justify-between gap-3 font-medium">
                <dt>Recibes al liberar todo</dt>
                <dd className="amount">{formatUsdc(preview.payeeAmount)} USDC</dd>
              </div>
            </dl>
          )}
          <p className="text-xs text-muted-foreground">Máximo {formatUsdc(DEFAULT_MAX_ESCROW_AMOUNT)} USDC por acuerdo.</p>
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Crear link de cobro
          </Button>
        </div>
      </aside>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
