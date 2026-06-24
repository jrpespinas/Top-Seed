import { OfflineBanner } from "../../components/domain/offline-banner.js";

export interface SessionSyncBarProps {
  connectionStatus: "online" | "offline";
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  pendingCount: number;
  failedCount: number;
  blockedCount: number;
  lastSyncedAt?: string;
  onRetry: () => void;
  onReview: () => void;
}

export function SessionSyncBar({
  connectionStatus,
  syncStatus,
  pendingCount,
  failedCount,
  blockedCount,
  lastSyncedAt,
  onRetry,
  onReview,
}: SessionSyncBarProps) {
  return (
    <OfflineBanner
      connectionStatus={connectionStatus}
      syncStatus={syncStatus}
      pendingCount={pendingCount}
      failedCount={failedCount}
      blockedCount={blockedCount}
      lastSyncedAt={lastSyncedAt}
      onRetry={onRetry}
      onReview={onReview}
    />
  );
}
