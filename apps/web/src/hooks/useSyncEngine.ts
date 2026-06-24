import { useCallback, useEffect, useState } from "react";
import { countOutboxByStatus } from "../sync/outbox.js";
import { flushOutbox, retryFailedOutbox } from "../sync/syncEngine.js";
import { getConnectionStatus, subscribeConnection } from "../sync/connection.js";

export function useSyncEngine(sessionId?: string) {
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline">(
    getConnectionStatus() ? "online" : "offline",
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"pending" | "syncing" | "synced" | "failed">(
    "synced",
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>();

  const refreshCounts = useCallback(async () => {
    const counts = await countOutboxByStatus(sessionId);
    setPendingCount(counts.pending);
    setFailedCount(counts.failed);
    setBlockedCount(counts.blocked);
    if (counts.failed > 0) {
      setSyncStatus("failed");
    } else if (counts.pending > 0 || counts.blocked > 0) {
      setSyncStatus("pending");
    } else {
      setSyncStatus("synced");
    }
  }, [sessionId]);

  const runSync = useCallback(async () => {
    if (!getConnectionStatus()) {
      return;
    }
    setSyncStatus("syncing");
    const result = await flushOutbox(sessionId);
    await refreshCounts();
    if (result.failed === 0 && result.flushed > 0) {
      setLastSyncedAt(new Date().toISOString());
      setSyncStatus("synced");
    } else if (result.failed > 0) {
      setSyncStatus("failed");
    }
  }, [sessionId, refreshCounts]);

  const retry = useCallback(async () => {
    setSyncStatus("syncing");
    await retryFailedOutbox(sessionId);
    await refreshCounts();
    setLastSyncedAt(new Date().toISOString());
  }, [sessionId, refreshCounts]);

  useEffect(() => {
    void refreshCounts();
    const interval = window.setInterval(() => void refreshCounts(), 2000);
    return () => window.clearInterval(interval);
  }, [refreshCounts]);

  useEffect(() => {
    return subscribeConnection((online) => {
      setConnectionStatus(online ? "online" : "offline");
      if (online) {
        void runSync();
      }
    });
  }, [runSync]);

  useEffect(() => {
    if (connectionStatus === "online") {
      void runSync();
    }
  }, [connectionStatus, runSync]);

  const autoSync = useCallback(async () => {
    if (!getConnectionStatus()) {
      return;
    }
    const counts = await countOutboxByStatus(sessionId);
    if (counts.failed > 0 || counts.blocked > 0) {
      await retry();
    } else if (counts.pending > 0) {
      await runSync();
    }
  }, [sessionId, retry, runSync]);

  useEffect(() => {
    if (connectionStatus !== "online") {
      return;
    }
    const interval = window.setInterval(() => void autoSync(), 30_000);
    return () => window.clearInterval(interval);
  }, [connectionStatus, autoSync]);

  return {
    connectionStatus,
    syncStatus,
    pendingCount,
    failedCount,
    blockedCount,
    lastSyncedAt,
    runSync,
    retry,
    refreshCounts,
  };
}
