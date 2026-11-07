import { formatUsdc, type PublicCheckoutMilestone } from "@escrow/shared";
import type { ReactNode } from "react";
import { MilestoneStatusBadge } from "@/components/escrow/status-badge";
import { formatDate, milestoneTone, type StatusTone } from "@/lib/format";
import { cn } from "@/lib/utils";

const NODE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-2 border-border bg-card",
  vault: "border-2 border-vault bg-vault-soft",
  seal: "border-2 border-seal bg-seal",
  caution: "border-2 border-caution bg-caution-soft",
  muted: "border-2 border-muted-foreground/40 bg-muted",
};

/** Hitos como recorrido vertical: el nodo de cada tramo cambia de color según dónde está su dinero. */
export function MilestoneTrack({
  milestones,
  renderExtra,
}: {
  milestones: PublicCheckoutMilestone[];
  renderExtra?: (milestone: PublicCheckoutMilestone) => ReactNode;
}) {
  return (
    <ol className="relative">
      {milestones.map((milestone, index) => {
        const last = index === milestones.length - 1;
        return (
          <li key={milestone.id} className="relative grid grid-cols-[1.5rem_1fr] gap-x-4 pb-8 last:pb-0">
            <div className="relative flex justify-center" aria-hidden="true">
              <span className={cn("relative z-10 mt-1 size-4 rounded-full", NODE_CLASSES[milestoneTone(milestone.status)])} />
              {!last && <span className="absolute top-6 bottom-[-0.25rem] w-px bg-border" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-snug">{milestone.title}</h3>
                  {milestone.due_date && (
                    <p className="text-sm text-muted-foreground">Entrega estimada: {formatDate(milestone.due_date)}</p>
                  )}
                </div>
                <p className="amount font-heading text-xl font-semibold">
                  {formatUsdc(milestone.amount)} <span className="text-sm font-normal text-muted-foreground">USDC</span>
                </p>
              </div>
              {milestone.description && <p className="mt-2 max-w-prose text-sm whitespace-pre-line">{milestone.description}</p>}
              <div className="mt-3">
                <MilestoneStatusBadge status={milestone.status} />
              </div>
              {renderExtra?.(milestone)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
