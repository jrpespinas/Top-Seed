import { cn } from "../../lib/cn.js";
import {
  formatCourtUiStatus,
  formatMatchStatus,
  formatPaymentStatus,
  formatQueueStatus,
  type CourtUiStatus,
} from "../../lib/format/status-labels.js";

export type StatusBadgeType = "queue" | "court" | "match" | "payment";
export type StatusBadgeSize = "compact" | "default" | "large";

export interface StatusBadgeProps {
  type: StatusBadgeType;
  status: string;
  size?: StatusBadgeSize;
  showIcon?: boolean;
}

function resolveLabel(type: StatusBadgeType, status: string): string {
  if (type === "queue") {
    return formatQueueStatus(status);
  }
  if (type === "court") {
    return formatCourtUiStatus(status as CourtUiStatus);
  }
  if (type === "match") {
    return formatMatchStatus(status);
  }
  return formatPaymentStatus(status);
}

const toneByStatus: Record<string, string> = {
  waiting: "bg-muted text-foreground",
  playing: "bg-court text-court-foreground",
  in_progress: "bg-court text-court-foreground",
  inProgress: "bg-court text-court-foreground",
  open: "bg-emerald-100 text-success",
  unpaid: "bg-attention-surface text-attention",
  partial: "bg-attention-surface text-attention",
  paid: "bg-emerald-100 text-success",
  completed: "bg-muted text-muted-foreground",
  done: "bg-muted text-muted-foreground",
  removed: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({ type, status, size = "default" }: StatusBadgeProps) {
  const label = resolveLabel(type, status);
  const padding =
    size === "compact" ? "px-2 py-0.5 text-caption" : size === "large" ? "px-3 py-1.5 text-body" : "px-2.5 py-1 text-caption";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        padding,
        toneByStatus[status] ?? "bg-muted text-foreground",
      )}
    >
      {label}
    </span>
  );
}
