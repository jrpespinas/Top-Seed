import { useCallback, useState } from "react";
import { useSyncEngine } from "./useSyncEngine.js";
import { SyncReviewPanel } from "../features/sync/SyncReviewPanel.js";
import { retryOutboxAction } from "../sync/syncEngine.js";

export function useSyncReviewDrawer(sessionId?: string) {
  const [isOpen, setIsOpen] = useState(false);
  const sync = useSyncEngine(sessionId);

  const openReview = useCallback(() => setIsOpen(true), []);
  const closeReview = useCallback(() => setIsOpen(false), []);

  const retryAction = useCallback(
    async (actionId: string) => {
      await retryOutboxAction(actionId);
      await sync.refreshCounts();
    },
    [sync],
  );

  const retryAllFailed = useCallback(async () => {
    await sync.retry();
  }, [sync]);

  const panel = (
    <SyncReviewPanel
      sessionId={sessionId}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      connectionStatus={sync.connectionStatus}
      isSyncing={sync.syncStatus === "syncing"}
      failedCount={sync.failedCount}
      blockedCount={sync.blockedCount}
      pendingCount={sync.pendingCount}
      onRetryAction={retryAction}
      onRetryAllFailed={retryAllFailed}
    />
  );

  const needsReview = sync.failedCount > 0 || sync.blockedCount > 0;

  return {
    sync,
    isOpen,
    openReview,
    closeReview,
    needsReview,
    panel,
  };
}
