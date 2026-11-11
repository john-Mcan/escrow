"use client";

import { type ProgressStep, ProgressSteps, type StepState } from "@/components/loaders";
import type { TxStep } from "@/hooks/use-escrow-transactions";

interface StepDef {
  label: string;
  hint: string;
  /** Etapas del hook que corresponden a este paso. */
  stages: TxStep[];
}

/** Pasos de una operación de una sola transacción (liberar, reembolsar, disputar). */
export const SINGLE_TX_STEPS: StepDef[] = [
  { label: "Confirma la operación", hint: "Revisa y confirma en la ventana que se abrió.", stages: ["preparing", "authorizing", "signing"] },
  { label: "La red la registra", hint: "Suele tardar unos segundos.", stages: ["confirming"] },
  { label: "Actualizamos el acuerdo", hint: "Avisamos a la otra parte por email.", stages: ["syncing"] },
];

/** Pasos del depósito con permit: autorizar el monto y luego depositar. */
export const DEPOSIT_STEPS: StepDef[] = [
  { label: "Autoriza el monto", hint: "Confirma en la ventana que se abrió.", stages: ["preparing", "authorizing"] },
  { label: "Confirma el depósito", hint: "Revisa el monto y confirma.", stages: ["signing"] },
  { label: "La red registra tu pago", hint: "Suele tardar unos segundos.", stages: ["confirming"] },
  { label: "Actualizamos el acuerdo", hint: "Avisamos a quien te cobra.", stages: ["syncing"] },
];

/** Depósito con smart wallet: una sola confirmación. */
export const DEPOSIT_STEPS_SINGLE: StepDef[] = [
  { label: "Confirma el depósito", hint: "Revisa el monto y confirma en la ventana.", stages: ["preparing", "authorizing", "signing"] },
  { label: "La red registra tu pago", hint: "Suele tardar unos segundos.", stages: ["confirming"] },
  { label: "Actualizamos el acuerdo", hint: "Avisamos a quien te cobra.", stages: ["syncing"] },
];

/** Convierte la etapa actual en estados por paso. `extra` agrega pasos propios al final (p. ej. enviar evidencia). */
export function toProgress(defs: StepDef[], step: TxStep, finished = false): ProgressStep[] {
  const current = defs.findIndex((def) => def.stages.includes(step));
  return defs.map((def, index) => {
    let state: StepState = "pending";
    if (finished || (current !== -1 && index < current)) state = "done";
    else if (index === current) state = "active";
    return { label: def.label, hint: def.hint, state };
  });
}

export function TxProgress({ defs, step, finished }: { defs: StepDef[]; step: TxStep; finished?: boolean }) {
  return <ProgressSteps steps={toProgress(defs, step, finished)} />;
}
