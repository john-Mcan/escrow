import { formatUsdc } from "@escrow/shared";
import { ArrowUpRightIcon } from "lucide-react";
import { TxLink } from "@/components/escrow/tx-link";
import type { ActivityItem, EvidenceItem } from "@/lib/api-types";
import { ACTIVITY_LABELS, formatDateTime } from "@/lib/format";

function describe(item: ActivityItem, milestoneTitles: Map<number, string>): string | null {
  const milestone = item.milestoneIndex !== null ? milestoneTitles.get(item.milestoneIndex) : undefined;
  const meta = item.metadata;
  switch (item.actionType) {
    case "funded":
      return `${formatUsdc(String(meta.total_amount ?? "0"))} USDC quedaron en garantía`;
    case "released":
      return `${milestone ?? "Hito"}: ${formatUsdc(String(meta.payee_amount ?? "0"))} USDC para el proveedor`;
    case "refunded":
      return `${milestone ?? "Hito"}: ${formatUsdc(String(meta.amount ?? "0"))} USDC devueltos al cliente`;
    case "dispute_resolved":
      return `${milestone ?? "Hito"}: ${formatUsdc(String(meta.payer_amount ?? "0"))} USDC al cliente y ${formatUsdc(String(meta.payee_amount ?? "0"))} USDC al proveedor`;
    case "deliverable_submitted":
    case "dispute_opened":
      return milestone ?? null;
    default:
      return null;
  }
}

/** Historial del acuerdo: cada movimiento de dinero enlaza a su comprobante público. */
export function ActivityTimeline({
  chainId,
  activity,
  evidence,
  milestoneTitles,
}: {
  chainId: number;
  activity: ActivityItem[];
  evidence: EvidenceItem[];
  milestoneTitles: Map<number, string>;
}) {
  return (
    <section aria-labelledby="activity-heading" className="space-y-6">
      <h2 id="activity-heading">Historial</h2>
      <ol className="space-y-5">
        {activity.map((item) => {
          const detail = describe(item, milestoneTitles);
          return (
            <li key={item.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 sm:gap-x-5">
              <span className="mt-2.5 size-1.5 justify-self-center rounded-full bg-line-strong" aria-hidden="true" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
                <div className="min-w-0">
                  <p className="font-medium">{ACTIVITY_LABELS[item.actionType]}</p>
                  {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
                </div>
                <p className="flex items-center gap-4 t-meta">
                  <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                  {item.txHash && (
                    <TxLink chainId={chainId} hash={item.txHash} label="Comprobante" className="text-[0.8125rem]" />
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {evidence.length > 0 && (
        <div className="space-y-4 border-t border-border pt-6">
          <h3>Versiones enviadas al árbitro</h3>
          <ul className="space-y-5">
            {evidence.map((item) => (
              <li key={item.id} className="border-l-2 border-caution/50 pl-4">
                <p className="t-meta">
                  {item.submittedBy ?? "Participante"} sobre &quot;
                  {milestoneTitles.get(item.milestoneIndex) ?? "un hito"}&quot;, {formatDateTime(item.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-line">{item.comment}</p>
                {item.attachmentUrl && (
                  <a
                    href={item.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/att mt-1 inline-flex items-center gap-0.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Ver adjunto
                    <ArrowUpRightIcon
                      className="size-3.5 transition-transform group-hover/att:translate-x-0.5 group-hover/att:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
