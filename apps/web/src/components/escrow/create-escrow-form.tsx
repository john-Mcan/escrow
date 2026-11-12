"use client";

import {
  computeSplit,
  createEscrowSchema,
  DEFAULT_MAX_ESCROW_AMOUNT,
  formatBps,
  formatUsdc,
  MAX_MILESTONES,
  milestoneEscrowAbi,
} from "@escrow/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useReadContract } from "wagmi";
import { DetailRow } from "@/components/disclosure";
import { AddOptional, Field, Panel } from "@/components/escrow/form-fields";
import { type CreatedLink, LinkCreated } from "@/components/escrow/link-created";
import { emptyMilestone, type MilestoneDraft, MilestoneDraftFields, safeAmount } from "@/components/escrow/milestone-draft-fields";
import { Spinner } from "@/components/loaders";
import { LocalAmountPicker, Usdc } from "@/components/money";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import type { CreateEscrowResponse, MeResponse } from "@/lib/api-types";
import { appChain, escrowContractAddress } from "@/lib/env";
import { describeTxError } from "@/lib/tx-errors";
import { cn } from "@/lib/utils";

/**
 * Crear un link de cobro en tres decisiones: quién cobra (precargado), qué se cobra y cuánto por hito. Lo opcional
 * (descripción, detalle, fecha) queda a un clic.
 */
export function CreateEscrowForm() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [displayName, setDisplayName] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(() => [emptyMilestone()]);
  const [showDescription, setShowDescription] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<CreatedLink | null>(null);

  useEffect(() => {
    if (me?.displayName && !displayName) setDisplayName(me.displayName);
  }, [displayName, me?.displayName]);

  const { data: feeBps } = useReadContract({
    address: escrowContractAddress,
    abi: milestoneEscrowAbi,
    functionName: "platformFeeBps",
    chainId: appChain.id,
  });

  const total = milestones.reduce((sum, m) => sum + safeAmount(m.amount), 0n);
  const overMax = total > DEFAULT_MAX_ESCROW_AMOUNT;
  const preview = feeBps !== undefined ? computeSplit(total, feeBps) : null;
  const single = milestones.length === 1;

  const setFieldError = (field: string, message: string | null) =>
    setErrors((current) => {
      if (message === null) {
        if (!(field in current)) return current;
        const rest = { ...current };
        delete rest[field];
        return rest;
      }
      return { ...current, [field]: message };
    });

  const update = (key: number, patch: Partial<MilestoneDraft>) =>
    setMilestones((current) => current.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const input = {
      title,
      description: String(form.get("description") ?? "") || undefined,
      payerEmail: String(form.get("payerEmail") ?? "").trim() || undefined,
      milestones: milestones.map((m) => ({
        // Con un solo hito, su nombre puede quedar vacío: se usa el del acuerdo.
        title: m.title.trim() || (single ? title : ""),
        description: m.description || undefined,
        amount: m.amount,
        dueDate: m.dueDate || undefined,
      })),
    };

    const next: Record<string, string> = {};
    if (!displayName.trim()) next.displayName = "Escribe cómo te verá tu cliente";
    const parsed = createEscrowSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      toast.error("Revisa los campos marcados.");
      return;
    }

    setErrors({});
    setPending(true);
    try {
      if (displayName.trim() !== me?.displayName) {
        const profile = await api<MeResponse>("/api/me", {
          method: "POST",
          body: JSON.stringify({ displayName: displayName.trim() }),
        });
        queryClient.setQueriesData({ queryKey: ["me"] }, profile);
      }
      const result = await api<CreateEscrowResponse>("/api/escrows", { method: "POST", body: JSON.stringify(input) });
      await queryClient.invalidateQueries({ queryKey: ["escrows"] });
      setCreated({ ...result, title, total });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(describeTxError(error));
    } finally {
      setPending(false);
    }
  }

  if (created) return <LinkCreated created={created} providerName={displayName} />;

  return (
    <form onSubmit={submit} noValidate className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-6">
        <div className="space-y-3 pb-4">
          <Link
            href="/dashboard"
            className="group/back inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4 transition-transform duration-200 group-hover/back:-translate-x-0.5" /> Mis acuerdos
          </Link>
          <h1>Nuevo link de cobro</h1>
          <p className="t-lead">Divide el trabajo en hitos. Tu cliente deposita el total y tú cobras cada hito al entregarlo.</p>
        </div>

        <Panel title="El acuerdo" description="Lo que verá tu cliente al abrir el link.">
          <Field label="Nombre del trabajo" htmlFor="title" error={errors.title}>
            <Input id="title" name="title" maxLength={140} placeholder="Rediseño del sitio web" aria-invalid={!!errors.title} />
          </Field>
          {showDescription ? (
            <Field label="Descripción" htmlFor="description" error={errors.description} hint="Alcance, condiciones o lo que tu cliente deba saber.">
              <Textarea id="description" name="description" maxLength={5000} rows={3} autoFocus />
            </Field>
          ) : (
            <div className="-ml-3">
              <AddOptional onClick={() => setShowDescription(true)}>Agregar descripción</AddOptional>
            </div>
          )}
          <div className="grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
            <Field
              label="Tu nombre o el de tu negocio"
              htmlFor="displayName"
              error={errors.displayName}
              hint="Así apareces en el link y en los emails."
            >
              <Input
                id="displayName"
                value={displayName}
                maxLength={80}
                autoComplete="organization"
                placeholder="Estudio Pampa"
                onChange={(event) => setDisplayName(event.target.value)}
                aria-invalid={!!errors.displayName}
              />
            </Field>
            <Field
              label="Email de tu cliente (opcional)"
              htmlFor="payerEmail"
              error={errors.payerEmail}
              hint="Le enviamos el link y le avisamos de cada entrega."
            >
              <Input
                id="payerEmail"
                name="payerEmail"
                type="email"
                autoComplete="off"
                placeholder="cliente@empresa.com"
                aria-invalid={!!errors.payerEmail}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Hitos"
          description={
            single
              ? "Con un solo hito, tu cliente libera el total al aprobar la entrega."
              : "Cada hito es una entrega con su monto. Lo cobras cuando tu cliente la aprueba."
          }
        >
          {errors.milestones && (
            <Reveal>
              <p className="text-sm text-destructive">{errors.milestones}</p>
            </Reveal>
          )}
          <ol className="-mt-1 divide-y divide-border">
            {milestones.map((milestone, index) => (
              <MilestoneDraftFields
                key={milestone.key}
                milestone={milestone}
                index={index}
                single={single}
                errors={errors}
                onChange={(patch) => update(milestone.key, patch)}
                onRemove={() => setMilestones((current) => current.filter((m) => m.key !== milestone.key))}
                onAmountError={(message) => setFieldError(`milestones.${index}.amount`, message)}
              />
            ))}
          </ol>
          <button
            type="button"
            disabled={milestones.length >= MAX_MILESTONES}
            onClick={() => setMilestones((current) => [...current, emptyMilestone()])}
            className="group/add flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-primary/50 hover:bg-seal-soft hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <PlusIcon className="size-4 transition-transform duration-200 group-hover/add:rotate-90" aria-hidden="true" />
            {milestones.length >= MAX_MILESTONES ? `Máximo ${MAX_MILESTONES} hitos` : "Agregar otro hito"}
          </button>
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="rounded-2xl border border-border bg-surface surface-edge">
          <div className="space-y-1 p-6">
            <p className="text-sm text-muted-foreground">Tu cliente deposita</p>
            <Usdc
              amount={total}
              className={cn("block text-[2.25rem] leading-tight font-semibold tracking-[-0.035em]", overMax && "text-destructive")}
              unitClassName="text-base tracking-normal"
            />
            <LocalAmountPicker amount={total} />
          </div>
          <div className="space-y-5 border-t border-border p-6">
            {preview && (
              <dl className="text-sm">
                <DetailRow label={`Comisión de extan (${formatBps(Number(feeBps))})`}>
                  <span className="amount">{preview.fee > 0n && "−"}{formatUsdc(preview.fee)}</span>
                </DetailRow>
                <DetailRow label="Recibes en total" className="font-medium">
                  <Usdc amount={preview.payeeAmount} unitClassName="text-muted-foreground" />
                </DetailRow>
              </dl>
            )}
            <Button type="submit" size="xl" className="w-full" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Creando tu link…" : "Crear link de cobro"}
            </Button>
            <p className={cn("text-xs", overMax ? "text-destructive" : "text-subtle")}>
              Máximo {formatUsdc(DEFAULT_MAX_ESCROW_AMOUNT)} USDC por acuerdo. La comisión se descuenta solo de lo que recibes.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
