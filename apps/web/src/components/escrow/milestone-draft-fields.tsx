"use client";

import { formatUsdc, parseUsdc, USDC_INPUT_HINT, USDC_INPUT_PATTERN } from "@escrow/shared";
import { TextIcon, XIcon } from "lucide-react";
import { AddOptional, DueDatePicker, Field } from "@/components/escrow/form-fields";
import { MilestoneNode } from "@/components/escrow/milestone-track";
import { LocalAmount } from "@/components/money";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface MilestoneDraft {
  key: number;
  title: string;
  description: string;
  amount: string;
  dueDate: string;
  showDetail: boolean;
}

let nextKey = 1;
export const emptyMilestone = (): MilestoneDraft => ({
  key: nextKey++,
  title: "",
  description: "",
  amount: "",
  dueDate: "",
  showDetail: false,
});

/** Monto escrito por el usuario en unidades base de USDC; 0 mientras no sea un monto válido. */
export function safeAmount(value: string): bigint {
  return USDC_INPUT_PATTERN.test(value.trim()) ? parseUsdc(value) : 0n;
}

interface MilestoneDraftFieldsProps {
  milestone: MilestoneDraft;
  index: number;
  /** Con un solo hito no se puede quitar y su nombre puede quedar vacío (se usa el del acuerdo). */
  single: boolean;
  /** Errores del formulario con la ruta de Zod (`milestones.0.amount`). */
  errors: Record<string, string>;
  onChange: (patch: Partial<MilestoneDraft>) => void;
  onRemove: () => void;
  onAmountError: (message: string | null) => void;
}

/** Un hito del formulario de creación: qué se entrega y cuánto, con el detalle y la fecha como opcionales. */
export function MilestoneDraftFields({
  milestone,
  index,
  single,
  errors,
  onChange,
  onRemove,
  onAmountError,
}: MilestoneDraftFieldsProps) {
  const fieldId = (name: string) => `m-${milestone.key}-${name}`;
  const error = (name: string) => errors[`milestones.${index}.${name}`];
  const amount = safeAmount(milestone.amount);

  return (
    <li className="space-y-4 py-6 first:pt-0 animate-in fade-in-0 slide-in-from-top-1 duration-300">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="flex items-center gap-3 text-[0.9375rem]">
          <MilestoneNode status={amount > 0n ? "funded" : "pending"} />
          Hito {index + 1}
        </h3>
        {!single && (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onRemove}>
            <XIcon /> Quitar
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field label="Qué entregas" htmlFor={fieldId("title")} error={error("title")}>
          <Input
            id={fieldId("title")}
            value={milestone.title}
            maxLength={140}
            placeholder={single ? "Igual que el nombre del trabajo" : "Diseño de la página principal"}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-invalid={!!error("title")}
          />
        </Field>
        <Field
          label="Monto en USDC"
          htmlFor={fieldId("amount")}
          error={error("amount")}
          hint={amount > 0n && <LocalAmount amount={amount} className="block text-right" />}
        >
          <Input
            id={fieldId("amount")}
            value={milestone.amount}
            inputMode="decimal"
            placeholder="0,00"
            className="amount text-right text-base font-medium"
            onChange={(e) => {
              onChange({ amount: e.target.value });
              if (USDC_INPUT_PATTERN.test(e.target.value.trim())) onAmountError(null);
            }}
            onBlur={(e) => {
              // Al salir del campo, el monto queda escrito como se mostrará ("2500" -> "2.500,00"); lo
              // ambiguo ("2.5") se marca ahí mismo, antes de crear el link.
              const raw = e.currentTarget.value.trim();
              if (!raw) return;
              if (USDC_INPUT_PATTERN.test(raw)) onChange({ amount: formatUsdc(parseUsdc(raw)) });
              else onAmountError(USDC_INPUT_HINT);
            }}
            aria-invalid={!!error("amount")}
          />
        </Field>
      </div>
      {milestone.showDetail && (
        <Field
          label="Detalle (opcional)"
          htmlFor={fieldId("description")}
          hint="Qué incluye la entrega, en qué formato o cuántas revisiones."
        >
          <Textarea
            id={fieldId("description")}
            value={milestone.description}
            maxLength={5000}
            rows={2}
            autoFocus
            className="min-h-16"
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>
      )}
      <div className="-ml-3 flex flex-wrap items-center gap-x-1 gap-y-1">
        {!milestone.showDetail && (
          <AddOptional onClick={() => onChange({ showDetail: true })} icon={<TextIcon />}>
            Agregar detalle
          </AddOptional>
        )}
        <DueDatePicker id={fieldId("due")} value={milestone.dueDate} onChange={(dueDate) => onChange({ dueDate })} />
      </div>
      {error("dueDate") && (
        <Reveal>
          <p className="text-sm text-destructive">{error("dueDate")}</p>
        </Reveal>
      )}
    </li>
  );
}
