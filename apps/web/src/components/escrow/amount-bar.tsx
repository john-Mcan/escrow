import { formatUsdc, type MilestoneStatus } from "@escrow/shared";
import { milestoneTone, type StatusTone } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Segment {
  amount: string;
  status: MilestoneStatus;
  title: string;
}

const SEGMENT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-[repeating-linear-gradient(135deg,var(--border)_0_6px,transparent_6px_12px)] ring-1 ring-inset ring-border",
  vault: "bg-vault",
  seal: "bg-seal",
  caution: "bg-caution",
  muted: "bg-muted-foreground/25",
};

const LEGEND: { tone: StatusTone; label: string }[] = [
  { tone: "neutral", label: "Sin depositar" },
  { tone: "vault", label: "En garantía" },
  { tone: "seal", label: "Pagado" },
  { tone: "caution", label: "En disputa" },
  { tone: "muted", label: "Reembolsado" },
];

/**
 * El total del acuerdo partido en tramos proporcionales a cada hito y coloreados por dónde está el dinero.
 * Es la lectura principal del link de cobro: cuánto espera en garantía, cuánto ya se pagó y cuánto está en disputa.
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
      <div className="flex h-3 w-full gap-1" role="img" aria-label="Distribución del dinero por hito">
        {segments.map((segment, index) => {
          const share = total > 0n ? Number((BigInt(segment.amount) * 10_000n) / total) / 100 : 0;
          return (
            <div
              key={index}
              title={`${segment.title}: ${formatUsdc(segment.amount)} USDC`}
              className={cn("min-w-2 rounded-[3px]", SEGMENT_CLASSES[milestoneTone(segment.status)])}
              style={{ flexGrow: share, flexBasis: 0 }}
            />
          );
        })}
      </div>
      {showLegend && (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {LEGEND.filter((item) => byTone.has(item.tone)).map((item) => (
            <div key={item.tone} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-[2px]", SEGMENT_CLASSES[item.tone])} aria-hidden="true" />
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="amount font-medium">{formatUsdc(byTone.get(item.tone) ?? 0n)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
