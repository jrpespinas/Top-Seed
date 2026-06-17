export interface SyncStatusBadgeProps {
  status: "local" | "pending" | "syncing" | "synced" | "failed";
  pendingCount?: number;
  lastSyncedAt?: string;
  lastError?: string;
  size?: "compact" | "default" | "large";
}

const LABELS: Record<SyncStatusBadgeProps["status"], string> = {
  local: "Local only",
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
  const padding = size === "compact" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  const tone =
    status === "failed"
      ? "bg-red-100 text-red-800"
      : status === "synced"
        ? "bg-emerald-100 text-emerald-800"
        : status === "syncing"
          ? "bg-blue-100 text-blue-800"
          : "bg-amber-100 text-amber-900";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${tone}`}>
      {LABELS[status]}
      {pendingCount && pendingCount > 1 ? ` (${pendingCount})` : ""}
      {lastError ? <span className="sr-only">{lastError}</span> : null}
      {lastSyncedAt && size !== "compact" ? (
        <span className="text-xs font-normal opacity-70">
          {new Date(lastSyncedAt).toLocaleTimeString()}
        </span>
      ) : null}
    </span>
  );
}
