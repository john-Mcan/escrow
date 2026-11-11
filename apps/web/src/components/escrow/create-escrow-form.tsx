"use client";

import {
  computeSplit,
  createEscrowSchema,
  DEFAULT_MAX_ESCROW_AMOUNT,
  formatBps,
  formatUsdc,
  MAX_MILESTONES,
  milestoneEscrowAbi,
  parseUsdc,
  USDC_INPUT_PATTERN,
} from "@escrow/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowUpRightIcon, CalendarPlusIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { useReadContract } from "wagmi";
import { DetailRow } from "@/components/disclosure";
import { ShareLink } from "@/components/escrow/share-link";
import { MarkGlyph, Spinner } from "@/components/loaders";
import { LocalAmountPicker, Usdc } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import type { CreateEscrowResponse, MeResponse } from "@/lib/api-types";
import { appChain, escrowContractAddress } from "@/lib/env";
import { describeTxError } from "@/lib/tx-errors";
import { cn } from "@/lib/utils";

interface MilestoneDraft {
  key: number;
  title: string;
  description: string;
  amount: string;
  dueDate: string;
  showMore: boolean;
}

let nextKey = 1;
const emptyMilestone = (): MilestoneDraft => ({
  key: nextKey++,
  title: "",
  description: "",
  amount: "",
  dueDate: "",
  showMore: false,
});

function safeAmount(value: string): bigint {
  return USDC_INPUT_PATTERN.test(value.trim()) ? parseUsdc(value) : 0n;
}

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
  const [created, setCreated] = useState<(CreateEscrowResponse & { title: string; total: bigint }) | null>(null);

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

  if (created) {
    return (
      <div className="mx-auto max-w-xl space-y-8 py-4">
        <div className="space-y-5">
          <MarkGlyph state="done" className="h-10 w-[3.125rem]" />
          <div className="space-y-2">
            <h1>Tu link de cobro está listo</h1>
            <p className="t-lead">
              {created.invitationSent
                ? "Ya le enviamos la invitación a tu cliente. También puedes compartirlo por donde conversan."
                : "Envíalo por donde conversas con tu cliente."}{" "}
              Te avisaremos por email cuando deposite.
            </p>
          </div>
        </div>
        <ShareLink url={created.url} title={created.title} total={created.total} providerName={displayName} />
        <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-6">
          <Button asChild variant="ghost" className="group/see -ml-4">
            <Link href={`/pay/${created.shortCode}`}>
              Ver como lo verá tu cliente
              <ArrowUpRightIcon className="transition-transform duration-200 group-hover/see:translate-x-0.5 group-hover/see:-translate-y-0.5" />
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard">Volver a mis acuerdos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-12">
        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="group/back inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4 transition-transform duration-200 group-hover/back:-translate-x-0.5" /> Mis acuerdos
          </Link>
          <h1>Nuevo link de cobro</h1>
          <p className="t-lead">Divide el trabajo en hitos. Tu cliente deposita el total y tú cobras cada hito al entregarlo.</p>
        </div>

        <Section title="Quién cobra" description="Así aparecerás en el link y en los emails que recibe tu cliente.">
          <Field label="Tu nombre o el de tu negocio" htmlFor="displayName" error={errors.displayName}>
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
        </Section>

        <Section title="Qué cobras">
          <Field label="Nombre del trabajo" htmlFor="title" error={errors.title}>
            <Input id="title" name="title" maxLength={140} placeholder="Rediseño del sitio web" aria-invalid={!!errors.title} />
          </Field>
          {showDescription ? (
            <Field label="Descripción" htmlFor="description" error={errors.description} hint="Alcance, condiciones o lo que tu cliente deba saber.">
              <Textarea id="description" name="description" maxLength={5000} rows={3} autoFocus />
            </Field>
          ) : (
            <AddOptional onClick={() => setShowDescription(true)}>Agregar descripción</AddOptional>
          )}
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
        </Section>

        <Section
          title="Hitos"
          description={single ? "Con un solo hito, tu cliente libera el total al aprobar la entrega." : "Cada hito se cobra por separado."}
        >
          {errors.milestones && <p className="text-sm text-destructive">{errors.milestones}</p>}
          <ol className="divide-y divide-border border-y border-border">
            {milestones.map((milestone, index) => (
              <li key={milestone.key} className="space-y-4 py-6 animate-in fade-in-0 slide-in-from-top-1 duration-300">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[0.9375rem]">Hito {index + 1}</h3>
                  {!single && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMilestones((current) => current.filter((m) => m.key !== milestone.key))}
                    >
                      <XIcon /> Quitar
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <Field
                    label="Qué entregas"
                    htmlFor={`m-${milestone.key}-title`}
                    error={errors[`milestones.${index}.title`]}
                  >
                    <Input
                      id={`m-${milestone.key}-title`}
                      value={milestone.title}
                      maxLength={140}
                      placeholder={single ? "Igual que el nombre del trabajo" : "Diseño de la página principal"}
                      onChange={(e) => update(milestone.key, { title: e.target.value })}
                      aria-invalid={!!errors[`milestones.${index}.title`]}
                    />
                  </Field>
                  <Field label="Monto en USDC" htmlFor={`m-${milestone.key}-amount`} error={errors[`milestones.${index}.amount`]}>
                    <Input
                      id={`m-${milestone.key}-amount`}
                      value={milestone.amount}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="amount text-right text-base font-medium"
                      onChange={(e) => update(milestone.key, { amount: e.target.value })}
                      aria-invalid={!!errors[`milestones.${index}.amount`]}
                    />
                  </Field>
                </div>
                {milestone.showMore ? (
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
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
                ) : (
                  <AddOptional onClick={() => update(milestone.key, { showMore: true })} icon={<CalendarPlusIcon />}>
                    Agregar detalle o fecha de entrega
                  </AddOptional>
                )}
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            disabled={milestones.length >= MAX_MILESTONES}
            onClick={() => setMilestones((current) => [...current, emptyMilestone()])}
          >
            <PlusIcon /> Agregar otro hito
          </Button>
        </Section>
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
                  <span className="amount">−{formatUsdc(preview.fee)}</span>
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

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="space-y-5">
      <div className="space-y-1">
        <h2 id={id}>{title}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function AddOptional({ onClick, children, icon }: { onClick: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="-ml-3" onClick={onClick}>
      {icon ?? <PlusIcon />} {children}
    </Button>
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
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
