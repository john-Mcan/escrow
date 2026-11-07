import { formatUsdc } from "@escrow/shared";
import { TxLink } from "@/components/escrow/tx-link";
import type { ActivityItem, EvidenceItem } from "@/lib/api-types";
import { ACTIVITY_LABELS, formatDateTime } from "@/lib/format";

function describe(item: ActivityItem, milestoneTitles: Map<number, string>): string | null {
  const milestone = item.milestoneIndex !== null ? milestoneTitles.get(item.milestoneIndex) : undefined;
  const meta = item.metadata;
  switch (item.actionType) {
    case "funded":
      return `${formatUsdc(String(meta.total_amount ?? "0"))} USDC depositados en garantía`;
    case "released":
      return `${milestone ?? "Hito"}: ${formatUsdc(String(meta.payee_amount ?? "0"))} USDC al proveedor`;
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

/** Historial auditable: cada movimiento on-chain enlaza a su recibo en Basescan. */
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
    <section aria-labelledby="activity-heading" className="space-y-4">
      <h2 id="activity-heading" className="text-xl font-semibold">
        Historial
      </h2>
      <ol className="space-y-3 border-l border-border pl-5">
        {activity.map((item) => {
          const detail = describe(item, milestoneTitles);
          return (
            <li key={item.id} className="relative text-sm">
              <span className="absolute top-1.5 -left-[1.6rem] size-2 rounded-full bg-border" aria-hidden="true" />
              <p className="font-medium">{ACTIVITY_LABELS[item.actionType]}</p>
              {detail && <p className="text-muted-foreground">{detail}</p>}
              <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{formatDateTime(item.createdAt)}</span>
                {item.txHash && <TxLink chainId={chainId} hash={item.txHash} label="recibo on-chain" />}
              </p>
            </li>
          );
        })}
      </ol>

      {evidence.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-base font-semibold">Evidencia aportada</h3>
          <ul className="space-y-3">
            {evidence.map((item) => (
              <li key={item.id} className="rounded-lg border bg-card p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {item.submittedBy ?? "Participante"} sobre {milestoneTitles.get(item.milestoneIndex) ?? "un hito"},{" "}
                  {formatDateTime(item.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-line">{item.comment}</p>
                {item.attachmentUrl && (
                  <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-vault underline-offset-4 hover:underline">
                    Ver adjunto
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
