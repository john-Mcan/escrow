import type { MilestoneStatus, PublicCheckoutMilestone } from "@escrow/shared";
import type { ReactNode } from "react";
import { MARK_CORE, MARK_LEFT_BRACKET, MARK_RIGHT_BRACKET } from "@/components/brand";
import { Usdc } from "@/components/money";
import { MilestoneStatusText } from "@/components/escrow/status";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Core = "empty" | "metal" | "seal" | "caution" | "void";

const NODE: Record<MilestoneStatus, { bracket: string; core: Core; open?: boolean; ping?: boolean }> = {
  pending: { bracket: "var(--line-strong)", core: "empty" },
  funded: { bracket: "var(--foreground)", core: "metal" },
  delivered_review: { bracket: "var(--foreground)", core: "metal", ping: true },
  released: { bracket: "var(--line-strong)", core: "seal", open: true },
  resolved: { bracket: "var(--line-strong)", core: "seal", open: true },
  disputed: { bracket: "var(--caution)", core: "caution" },
  refunded: { bracket: "var(--line-strong)", core: "void", open: true },
};

/**
 * Nodo del recorrido con la forma del isotipo: corchetes cerrados = dinero retenido; cuando el pago sale, los
 * corchetes se abren y el valor queda en esmeralda.
 */
export function MilestoneNode({ status, className }: { status: MilestoneStatus; className?: string }) {
  const node = NODE[status];
  const core = MARK_CORE;
  return (
    <span className={cn("relative inline-grid place-items-center", className)} aria-hidden="true">
      {node.ping && (
        <span className="absolute inset-0 m-auto size-3 rounded-[3px] bg-vault/50" style={{ animation: "ring-ping 2.2s ease-out infinite" }} />
      )}
      <svg viewBox="0 0 40 32" className="relative h-6 w-[1.875rem] overflow-visible">
        <defs>
          <linearGradient id="extan-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4f6f8" />
            <stop offset="36%" stopColor="#b2bac3" />
            <stop offset="60%" stopColor="#e4e8ec" />
            <stop offset="100%" stopColor="#8d96a0" />
          </linearGradient>
        </defs>
        <path
          d={MARK_LEFT_BRACKET}
          fill="none"
          stroke={node.bracket}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-500 ease-out"
          style={{ transform: node.open ? "translateX(-3px)" : undefined }}
        />
        <path
          d={MARK_RIGHT_BRACKET}
          fill="none"
          stroke={node.bracket}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-500 ease-out"
          style={{ transform: node.open ? "translateX(3px)" : undefined }}
        />
        {node.core === "empty" && (
          <rect
            x={core.x + 0.6}
            y={core.y + 0.6}
            width={core.size - 1.2}
            height={core.size - 1.2}
            rx={core.radius}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />
        )}
        {node.core === "void" && (
          <rect
            x={core.x + 0.6}
            y={core.y + 0.6}
            width={core.size - 1.2}
            height={core.size - 1.2}
            rx={core.radius}
            fill="none"
            stroke="var(--subtle)"
            strokeWidth="1.2"
          />
        )}
        {(node.core === "metal" || node.core === "seal" || node.core === "caution") && (
          <rect
            x={core.x}
            y={core.y}
            width={core.size}
            height={core.size}
            rx={core.radius}
            fill={node.core === "metal" ? "url(#extan-metal)" : node.core === "seal" ? "var(--seal)" : "var(--caution)"}
          />
        )}
      </svg>
    </span>
  );
}

/** Hitos como recorrido vertical: cada nodo muestra dónde está el dinero de ese tramo. */
export function MilestoneTrack({
  milestones,
  renderExtra,
}: {
  milestones: Pick<PublicCheckoutMilestone, "id" | "title" | "amount" | "status" | "description" | "due_date">[];
  renderExtra?: (index: number) => ReactNode;
}) {
  return (
    <ol className="relative">
      {milestones.map((milestone, index) => {
        const last = index === milestones.length - 1;
        const paid = milestone.status === "released" || milestone.status === "resolved";
        return (
          <li key={milestone.id} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 pb-10 last:pb-0 sm:gap-x-5">
            <div className="relative flex items-start justify-center pt-0.5">
              <MilestoneNode status={milestone.status} />
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn("absolute top-9 -bottom-1.5 w-px transition-colors duration-500", paid ? "bg-seal/40" : "bg-border")}
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h3 className="min-w-0 text-lg">{milestone.title}</h3>
                <Usdc amount={milestone.amount} className="text-lg font-semibold tracking-[-0.01em]" unitClassName="text-sm" />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1">
                <MilestoneStatusText status={milestone.status} />
                {milestone.due_date && <span className="t-meta">Entrega estimada {formatDate(milestone.due_date)}</span>}
              </div>
              {milestone.description && (
                <p className="mt-3 max-w-prose text-[0.9375rem] whitespace-pre-line text-muted-foreground">{milestone.description}</p>
              )}
              {renderExtra?.(index)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
