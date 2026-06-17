import { SyncStatusBadge } from "./SyncStatusBadge";

export interface OfflineBannerProps {
  connectionStatus: "online" | "offline";
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  pendingCount: number;
  failedCount: number;
  lastSyncedAt?: string;
  onRetry?: () => void;
  onReview?: () => void;
}

export function OfflineBanner({
  connectionStatus,
  syncStatus,
  pendingCount,
  failedCount,
  lastSyncedAt,
  onRetry,
  onReview,
}: OfflineBannerProps) {
  let message = "All changes synced.";
  if (connectionStatus === "offline") {
    message = "Offline. You can keep running this session.";
  } else if (failedCount > 0) {
    message = `Sync failed for ${failedCount} change(s). Review and retry.`;
  } else if (pendingCount > 0) {
    message = `${pendingCount} change${pendingCount === 1 ? "" : "s"} pending sync.`;
  } else if (syncStatus === "syncing") {
    message = "Syncing changes…";
  }

  const tone =
    connectionStatus === "offline"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : failedCount > 0
        ? "border-red-300 bg-red-50 text-red-900"
        : pendingCount > 0
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-emerald-300 bg-emerald-50 text-emerald-900";

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${tone}`}
      role="status"
      aria-live="polite"
    >
      <div>
        <p>{message}</p>
        {lastSyncedAt && connectionStatus === "online" && failedCount === 0 && pendingCount === 0 ? (
          <p className="mt-1 text-xs opacity-80">Last synced {new Date(lastSyncedAt).toLocaleTimeString()}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <SyncStatusBadge status={syncStatus} pendingCount={pendingCount} size="compact" />
        {failedCount > 0 && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-current px-2 py-1 text-xs font-medium"
          >
            Retry
          </button>
        ) : null}
        {failedCount > 0 && onReview ? (
          <button
            type="button"
            onClick={onReview}
            className="rounded-md border border-current px-2 py-1 text-xs font-medium"
          >
            Review
          </button>
        ) : null}
      </div>
    </div>
  );
}
