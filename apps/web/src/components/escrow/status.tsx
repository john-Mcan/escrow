import type { EscrowStatus, MilestoneStatus } from "@escrow/shared";
import type { ReactNode } from "react";
import {
  ESCROW_STATUS_LABELS,
  escrowTone,
  MILESTONE_STATUS_LABELS,
  milestoneTone,
  type StatusTone,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/** Marcador del estado: un cuadrito como el del isotipo, del color de donde está el dinero. */
export const TONE_MARKER: Record<StatusTone, string> = {
  neutral: "border border-subtle",
  vault: "bg-metal",
  seal: "bg-seal shadow-[0_0_10px_rgb(125_231_187/0.55)]",
  caution: "bg-caution",
  muted: "bg-subtle/60",
};

const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  vault: "text-vault",
  seal: "text-seal",
  caution: "text-caution",
  muted: "text-muted-foreground",
};

/** Estado como texto con marcador (sin pastillas): se lee como parte de la línea, no como etiqueta. */
export function StatusText({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap", TONE_TEXT[tone], className)}
    >
      <span className={cn("size-2 shrink-0 rounded-[2px]", TONE_MARKER[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

export function EscrowStatus({ status, className }: { status: EscrowStatus; className?: string }) {
  return (
    <StatusText tone={escrowTone(status)} className={className}>
      {ESCROW_STATUS_LABELS[status]}
    </StatusText>
  );
}

export function MilestoneStatusText({ status, className }: { status: MilestoneStatus; className?: string }) {
  return (
    <StatusText tone={milestoneTone(status)} className={className}>
      {MILESTONE_STATUS_LABELS[status]}
    </StatusText>
  );
}
