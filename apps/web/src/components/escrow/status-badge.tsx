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

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  vault: "bg-vault-soft text-vault",
  seal: "bg-seal-soft text-seal",
  caution: "bg-caution-soft text-caution",
  muted: "bg-muted text-muted-foreground",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "border border-muted-foreground/60",
  vault: "bg-vault",
  seal: "bg-seal",
  caution: "bg-caution",
  muted: "bg-muted-foreground/50",
};

export function StatusPill({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASSES[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

export function EscrowStatusBadge({ status }: { status: EscrowStatus }) {
  return <StatusPill tone={escrowTone(status)}>{ESCROW_STATUS_LABELS[status]}</StatusPill>;
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return <StatusPill tone={milestoneTone(status)}>{MILESTONE_STATUS_LABELS[status]}</StatusPill>;
}
