import { OfflineBanner } from "../../components/domain/offline-banner.js";
import { useSyncReviewDrawer } from "../../hooks/useSyncReviewDrawer.js";

export function SessionSyncBar({ sessionId }: { sessionId?: string }) {
  const syncReview = useSyncReviewDrawer(sessionId);
  const sync = syncReview.sync;

  if (
    sync.failedCount === 0 &&
    sync.blockedCount === 0 &&
    sync.pendingCount === 0 &&
    sync.connectionStatus === "online"
  ) {
    return syncReview.panel;
  }

  return (
    <>
      <OfflineBanner
        connectionStatus={sync.connectionStatus}
        syncStatus={sync.syncStatus}
        pendingCount={sync.pendingCount}
        failedCount={sync.failedCount}
        blockedCount={sync.blockedCount}
        lastSyncedAt={sync.lastSyncedAt}
        onRetry={() => void sync.retry()}
        onReview={syncReview.openReview}
      />
      {syncReview.panel}
    </>
  );
}
