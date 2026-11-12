"use client";

import type { MilestoneStatus } from "@escrow/shared";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { AmountBar } from "@/components/escrow/amount-bar";
import { MilestoneNode } from "@/components/escrow/milestone-track";
import { MilestoneStatusText } from "@/components/escrow/status";
import { LocalAmount, Usdc } from "@/components/money";
import { SpotlightCard } from "@/components/motion";

const MILESTONES = [
  { title: "Diseño de la tienda", amount: "600000000" },
  { title: "Desarrollo y catálogo", amount: "1400000000" },
  { title: "Lanzamiento y soporte", amount: "500000000" },
];
const TOTAL = "2500000000";

/** Secuencia única de la portada: el cliente aprueba la primera entrega y ese pago sale de la garantía. */
const TIMELINE: { at: number; statuses: MilestoneStatus[] }[] = [
  { at: 0, statuses: ["funded", "funded", "funded"] },
  { at: 1400, statuses: ["delivered_review", "funded", "funded"] },
  { at: 3000, statuses: ["released", "funded", "funded"] },
];

export function HeroDemo() {
  const [statuses, setStatuses] = useState<MilestoneStatus[]>(TIMELINE[0]!.statuses);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStatuses(TIMELINE[TIMELINE.length - 1]!.statuses);
      return;
    }
    const timers = TIMELINE.slice(1).map((frame) => setTimeout(() => setStatuses(frame.statuses), frame.at));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <SpotlightCard className="rounded-3xl border border-border bg-surface surface-edge" contentClassName="p-5 sm:p-8">
      <figure aria-label="Ejemplo de un link de cobro con tres hitos">
        <div className="flex items-center gap-3">
          <Avatar name="Estudio Pampa" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Estudio Pampa</span> te envió un acuerdo de pago
          </p>
        </div>
        <p className="mt-6 text-xl font-semibold tracking-[-0.02em]">Rediseño de tienda online</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <Usdc amount={TOTAL} className="text-[2.25rem] leading-tight font-semibold tracking-[-0.035em]" unitClassName="text-base tracking-normal" />
          <LocalAmount amount={TOTAL} className="text-sm" />
        </div>
        <AmountBar
          className="mt-5"
          showLegend={false}
          segments={MILESTONES.map((m, i) => ({ ...m, status: statuses[i] ?? "funded" }))}
        />
        <ol className="mt-6 divide-y divide-border border-t border-border">
          {MILESTONES.map((milestone, index) => {
            const status = statuses[index] ?? "funded";
            return (
              <li key={milestone.title} className="flex items-center gap-4 py-4">
                <MilestoneNode status={status} />
                <div className="min-w-0 flex-1">
                  <p className="leading-snug font-medium text-pretty sm:truncate">{milestone.title}</p>
                  <MilestoneStatusText status={status} className="text-[0.8125rem]" />
                </div>
                <Usdc
                  amount={milestone.amount}
                  className={status === "released" ? "font-semibold text-seal transition-colors duration-500" : "font-semibold transition-colors duration-500"}
                  unitClassName="text-xs"
                />
              </li>
            );
          })}
        </ol>
      </figure>
    </SpotlightCard>
  );
}
