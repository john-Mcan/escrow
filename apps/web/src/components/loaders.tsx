"use client";

import { useId } from "react";
import { MARK_CORE, MARK_LEFT_BRACKET, MARK_RIGHT_BRACKET } from "@/components/brand";
import { cn } from "@/lib/utils";

const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

/** Indicador en línea para botones y textos: un arco que gira, sin el peso visual del loader de marca. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-4 shrink-0 animate-spin rounded-full [animation-duration:0.75s]", className)}
      style={{
        background: "conic-gradient(from 0deg, transparent 0deg, currentColor 290deg, transparent 360deg)",
        WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))",
        mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))",
      }}
    />
  );
}

type MarkState = "idle" | "working" | "done";

/** El isotipo animado. `working`: los corchetes se cierran sobre el valor; `done`: el valor queda sellado. */
export function MarkGlyph({ state, className }: { state: MarkState; className?: string }) {
  const glowId = useId();
  const working = state === "working";
  const bracket = state === "idle" ? "var(--muted-foreground)" : "var(--foreground)";

  return (
    <svg viewBox="0 0 40 32" aria-hidden="true" className={cn("overflow-visible", className)}>
      <defs>
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>
      {working && (
        <rect
          x={MARK_CORE.x}
          y={MARK_CORE.y}
          width={MARK_CORE.size}
          height={MARK_CORE.size}
          rx={MARK_CORE.radius}
          fill="var(--primary)"
          filter={`url(#${glowId})`}
          style={{ animation: `core-glow 1.6s ${EASE} infinite` }}
        />
      )}
      <path
        d={MARK_LEFT_BRACKET}
        fill="none"
        stroke={bracket}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={working ? { animation: `bracket-left 1.6s ${EASE} infinite` } : undefined}
        className="transition-[stroke] duration-300"
      />
      <path
        d={MARK_RIGHT_BRACKET}
        fill="none"
        stroke={bracket}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={working ? { animation: `bracket-right 1.6s ${EASE} infinite` } : undefined}
        className="transition-[stroke] duration-300"
      />
      {state === "idle" && (
        <rect
          x={MARK_CORE.x + 0.6}
          y={MARK_CORE.y + 0.6}
          width={MARK_CORE.size - 1.2}
          height={MARK_CORE.size - 1.2}
          rx={MARK_CORE.radius}
          fill="none"
          stroke="var(--subtle)"
          strokeWidth="1.4"
          strokeDasharray="2 2"
        />
      )}
      {state !== "idle" && (
        <rect
          x={MARK_CORE.x}
          y={MARK_CORE.y}
          width={MARK_CORE.size}
          height={MARK_CORE.size}
          rx={MARK_CORE.radius}
          fill="var(--primary)"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: working ? `core-pulse 1.6s ${EASE} infinite` : `seal-in 0.5s ${EASE} both`,
          }}
        />
      )}
    </svg>
  );
}

/** Loader de marca para esperas largas (firma, confirmación en la red, carga de una página). */
export function ExtanLoader({ label, hint, className }: { label?: string; hint?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center gap-4 text-center", className)}>
      <MarkGlyph state="working" className="h-10 w-[3.125rem]" />
      {label ? (
        <div className="space-y-1">
          <p className="font-medium">{label}</p>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
      ) : (
        <span className="sr-only">Cargando</span>
      )}
    </div>
  );
}

/** Línea de trabajo indeterminada: un destello recorre el borde superior de un panel mientras algo se procesa. */
export function WorkLine({ active, className }: { active: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative h-px overflow-hidden bg-border", className)}>
      {active && (
        <span
          className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-primary to-transparent"
          style={{ animation: "progress-sweep 1.4s ease-in-out infinite" }}
        />
      )}
    </div>
  );
}

export type StepState = "done" | "active" | "pending";

export interface ProgressStep {
  label: string;
  hint?: string;
  state: StepState;
}

/** Pasos de un proceso que toma tiempo (p. ej. depositar): qué ya pasó, qué está pasando y qué falta. */
export function ProgressSteps({ steps, className }: { steps: ProgressStep[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li
            key={step.label}
            aria-current={step.state === "active" ? "step" : undefined}
            className="relative grid grid-cols-[2.25rem_1fr] gap-x-3 pb-5 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-8 bottom-1 left-[1.125rem] w-px -translate-x-1/2 bg-border"
              >
                <span
                  className={cn(
                    "absolute inset-x-0 top-0 bg-primary transition-[height] duration-500 ease-out",
                    step.state === "done" ? "h-full" : "h-0",
                  )}
                />
              </span>
            )}
            <MarkGlyph
              state={step.state === "done" ? "done" : step.state === "active" ? "working" : "idle"}
              className="mt-0.5 h-6 w-[1.875rem] justify-self-center"
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "leading-7 font-medium transition-colors duration-300",
                  step.state === "pending" && "text-subtle",
                  step.state === "done" && "text-muted-foreground",
                )}
              >
                {step.label}
                <span className="sr-only">
                  {step.state === "done" ? " (listo)" : step.state === "active" ? " (en curso)" : " (pendiente)"}
                </span>
              </p>
              {step.state === "active" && step.hint && <p className="text-sm text-muted-foreground">{step.hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
