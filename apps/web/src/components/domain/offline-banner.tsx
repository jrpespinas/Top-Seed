import { Button } from "../ui/button.js";
import { SyncStatusBadge } from "./sync-status-badge.js";
import { formatTime } from "../../lib/format/datetime.js";

export interface OfflineBannerProps {
  connectionStatus: "online" | "offline";
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  pendingCount: number;
  failedCount: number;
  blockedCount?: number;
  lastSyncedAt?: string;
  onRetry?: () => void;
  onReview?: () => void;
}

export function OfflineBanner({
  connectionStatus,
  syncStatus,
  pendingCount,
  failedCount,
  blockedCount = 0,
  lastSyncedAt,
  onRetry,
  onReview,
}: OfflineBannerProps) {
  let message = "All changes synced.";
  if (connectionStatus === "offline") {
    message = "Offline. You can keep running this session.";
  } else if (failedCount > 0) {
    message = `Sync failed for ${failedCount} change${failedCount === 1 ? "" : "s"}. Review and retry.`;
  } else if (blockedCount > 0) {
    message = `${blockedCount} change${blockedCount === 1 ? "" : "s"} blocked by an earlier failure. Review sync issues.`;
  } else if (pendingCount > 0) {
    message = `${pendingCount} change${pendingCount === 1 ? "" : "s"} pending sync.`;
  } else if (syncStatus === "syncing") {
    message = "Syncing changes…";
  }

  const tone =
    connectionStatus === "offline"
      ? "border-warning/40 bg-attention-surface text-foreground"
      : failedCount > 0
        ? "border-danger/30 bg-red-50 text-danger"
        : pendingCount > 0
          ? "border-warning/40 bg-attention-surface text-foreground"
          : "border-success/30 bg-emerald-50 text-success";

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border px-3 py-2 text-body ${tone}`}
      role="status"
      aria-live="polite"
    >
      <div>
        <p>{message}</p>
        {lastSyncedAt && connectionStatus === "online" && failedCount === 0 && pendingCount === 0 ? (
          <p className="mt-1 text-caption opacity-80">Last synced {formatTime(lastSyncedAt)}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <SyncStatusBadge status={syncStatus} pendingCount={pendingCount} size="compact" />
        {failedCount > 0 && onRetry ? (
          <Button variant="secondary" size="compact" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {failedCount > 0 && onReview ? (
          <Button variant="ghost" size="compact" onClick={onReview}>
            Review
          </Button>
        ) : null}
        {failedCount === 0 && blockedCount > 0 && onReview ? (
          <Button variant="ghost" size="compact" onClick={onReview}>
            Review
          </Button>
        ) : null}
      </div>
    </div>
  );
}
