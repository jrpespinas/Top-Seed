import { cn } from "../../lib/cn.js";
import { formatTime } from "../../lib/format/datetime.js";

export interface SyncStatusBadgeProps {
  status: "local" | "pending" | "syncing" | "synced" | "failed";
  pendingCount?: number;
  lastSyncedAt?: string;
  lastError?: string;
  size?: "compact" | "default" | "large";
}

const LABELS: Record<SyncStatusBadgeProps["status"], string> = {
  local: "Saved on this device",
  pending: "Pending sync",
  syncing: "Syncing",
  synced: "Synced",
  failed: "Sync failed",
};

export function SyncStatusBadge({
  status,
  pendingCount,
  lastSyncedAt,
  lastError,
  size = "default",
}: SyncStatusBadgeProps) {
  const padding =
    size === "compact" ? "px-2 py-0.5 text-caption" : size === "large" ? "px-3 py-1.5 text-body" : "px-2.5 py-1 text-caption";
  const tone =
    status === "failed"
      ? "bg-red-100 text-danger"
      : status === "synced"
        ? "bg-emerald-100 text-success"
        : status === "syncing"
          ? "bg-blue-100 text-blue-800"
          : status === "local"
            ? "bg-muted text-muted-foreground"
            : "bg-attention-surface text-attention";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full font-medium", padding, tone)}>
      {LABELS[status]}
      {pendingCount && pendingCount > 1 ? ` (${pendingCount})` : ""}
      {lastError ? <span className="sr-only">{lastError}</span> : null}
      {lastSyncedAt && size !== "compact" ? (
        <span className="text-caption font-normal opacity-70">{formatTime(lastSyncedAt)}</span>
      ) : null}
    </span>
  );
}
