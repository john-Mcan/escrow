import type { MilestoneStatus, PublicCheckoutMilestone } from "@escrow/shared";
import type { ReactNode } from "react";
import { MARK_CORE, MARK_LEFT_BRACKET, MARK_RIGHT_BRACKET } from "@/components/brand";
import { MilestoneStatusText } from "@/components/escrow/status";
import { TxLink } from "@/components/escrow/tx-link";
import { LocalAmount, Usdc } from "@/components/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Core = "empty" | "metal" | "seal" | "caution" | "void";

/** Los corchetes siempre se leen como el isotipo (contraste ≥ 7:1); el estado lo cuentan el núcleo y la apertura. */
const NODE: Record<MilestoneStatus, { bracket: string; core: Core; open?: boolean; ping?: boolean }> = {
  pending: { bracket: "var(--foreground)", core: "empty" },
  funded: { bracket: "var(--foreground)", core: "metal" },
  delivered_review: { bracket: "var(--foreground)", core: "metal", ping: true },
  released: { bracket: "var(--foreground)", core: "seal", open: true },
  resolved: { bracket: "var(--foreground)", core: "seal", open: true },
  disputed: { bracket: "var(--caution)", core: "caution" },
  refunded: { bracket: "var(--muted-foreground)", core: "void", open: true },
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
        <span
          className="absolute inset-0 m-auto size-3 rounded-[3px] bg-vault/50"
          style={{ animation: "ring-ping 2.2s ease-out infinite" }}
        />
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
            stroke="var(--muted-foreground)"
            strokeWidth="1.4"
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
            stroke="var(--muted-foreground)"
            strokeWidth="1.4"
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

const SETTLED: MilestoneStatus[] = ["released", "refunded", "resolved"];

/**
 * Hitos como filas de una misma superficie, igual que el ejemplo de la portada: el nodo dice dónde está el dinero,
 * el monto va en USDC con su equivalente local y, cuando el hito se cierra, la fecha estimada deja lugar al
 * comprobante.
 */
export function MilestoneTrack({
  milestones,
  chainId,
  renderExtra,
}: {
  milestones: Pick<
    PublicCheckoutMilestone,
    "id" | "title" | "amount" | "status" | "description" | "due_date" | "tx_hash_settled"
  >[];
  chainId: number;
  renderExtra?: (index: number) => ReactNode;
}) {
  return (
    <ol className="divide-y divide-border rounded-2xl border border-border bg-surface surface-edge">
      {milestones.map((milestone, index) => {
        const settled = SETTLED.includes(milestone.status);
        return (
          <li
            key={milestone.id}
            className="grid grid-cols-[1.875rem_minmax(0,1fr)] gap-x-4 p-5 transition-colors duration-500 sm:gap-x-5 sm:p-6"
          >
            <MilestoneNode status={milestone.status} className="mt-0.5 self-start" />
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-x-6">
                <div className="min-w-0">
                  <h3 className={cn("text-lg", milestone.status === "refunded" && "text-muted-foreground")}>
                    {milestone.title}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <MilestoneStatusText status={milestone.status} />
                    {!settled && milestone.due_date && (
                      <span className="t-meta">Entrega estimada {formatDate(milestone.due_date)}</span>
                    )}
                    {settled && milestone.tx_hash_settled && (
                      <TxLink
                        chainId={chainId}
                        hash={milestone.tx_hash_settled}
                        label="Comprobante"
                        className="text-[0.8125rem]"
                      />
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Usdc
                    amount={milestone.amount}
                    className={cn(
                      "block text-lg font-semibold tracking-[-0.01em] transition-colors duration-500",
                      milestone.status === "released" && "text-seal",
                      milestone.status === "refunded" && "text-muted-foreground",
                    )}
                    unitClassName="text-sm"
                  />
                  <LocalAmount amount={milestone.amount} className="block text-[0.8125rem]" />
                </div>
              </div>
              {milestone.description && (
                <p className="mt-3 max-w-prose text-[0.9375rem] whitespace-pre-line text-muted-foreground">
                  {milestone.description}
                </p>
              )}
              {renderExtra?.(index)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
