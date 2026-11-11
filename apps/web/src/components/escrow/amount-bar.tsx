import { formatUsdc, type MilestoneStatus } from "@escrow/shared";
import { milestoneTone, type StatusTone } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Segment {
  amount: string;
  status: MilestoneStatus;
  title: string;
}

const SEGMENT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-[repeating-linear-gradient(135deg,var(--line-strong)_0_1px,transparent_1px_6px)] ring-1 ring-inset ring-border",
  vault: "bg-metal",
  seal: "bg-seal",
  caution: "bg-caution",
  muted: "bg-subtle/40",
};

const LEGEND: { tone: StatusTone; label: string }[] = [
  { tone: "neutral", label: "Por depositar" },
  { tone: "vault", label: "En garantía" },
  { tone: "seal", label: "Pagado" },
  { tone: "caution", label: "En disputa" },
  { tone: "muted", label: "Reembolsado" },
];

/**
 * El total del acuerdo partido en tramos proporcionales a cada hito y coloreados por dónde está el dinero:
 * cuánto espera en garantía, cuánto ya se pagó y cuánto está en disputa.
 */
export function AmountBar({ segments, className, showLegend = true }: { segments: Segment[]; className?: string; showLegend?: boolean }) {
  const total = segments.reduce((sum, s) => sum + BigInt(s.amount), 0n);
  const byTone = new Map<StatusTone, bigint>();
  for (const s of segments) {
    const tone = milestoneTone(s.status);
    byTone.set(tone, (byTone.get(tone) ?? 0n) + BigInt(s.amount));
  }

  return (
    <div className={className}>
      <div className="flex h-2 w-full gap-1" role="img" aria-label="Distribución del dinero por hito">
        {segments.map((segment, index) => {
          const share = total > 0n ? Number((BigInt(segment.amount) * 10_000n) / total) / 100 : 0;
          return (
            <div
              key={index}
              title={`${segment.title}: ${formatUsdc(segment.amount)} USDC`}
              className={cn("min-w-2 rounded-full transition-[background,box-shadow] duration-500", SEGMENT_CLASSES[milestoneTone(segment.status)])}
              style={{ flexGrow: share, flexBasis: 0 }}
            />
          );
        })}
      </div>
      {showLegend && (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          {LEGEND.filter((item) => byTone.has(item.tone)).map((item) => (
            <div key={item.tone} className="flex items-center gap-2">
              <span className={cn("size-2 rounded-[2px]", SEGMENT_CLASSES[item.tone])} aria-hidden="true" />
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="amount font-medium">{formatUsdc(byTone.get(item.tone) ?? 0n)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
