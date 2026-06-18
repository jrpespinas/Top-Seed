import { useEffect, useState, type ReactNode } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/database.js";
import { getSessionMode } from "../lib/session-mode.js";
import { useSyncReviewDrawer } from "./useSyncReviewDrawer.js";
import type { LocalSession } from "../db/types.js";
import type { SessionMode } from "../components/domain/types.js";

export interface SessionChromeData {
  session: LocalSession | undefined;
  courtCount: number;
  sessionMode: SessionMode;
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  pendingCount: number;
  blockedCount: number;
  lastSyncedAt?: string;
  connectionStatus: "online" | "offline";
  retry: () => Promise<void>;
  openSyncReview: () => void;
  syncReviewPanel: ReactNode;
}

export function useSessionChrome(sessionId: string): SessionChromeData {
  const [session, setSession] = useState<LocalSession | undefined>();
  const [courtCount, setCourtCount] = useState(0);
  const syncReview = useSyncReviewDrawer(sessionId);
  const sync = syncReview.sync;

  useEffect(() => {
    const sub = liveQuery(async () => {
      const [sessionRow, courts] = await Promise.all([
        db.sessions.get(sessionId),
        db.courts.where("sessionId").equals(sessionId).toArray(),
      ]);
      return {
        session: sessionRow,
        courtCount: courts.filter((court) => court.status !== "deleted").length,
      };
    }).subscribe({
      next: (value) => {
        setSession(value.session);
        setCourtCount(value.courtCount);
      },
    });
    return () => sub.unsubscribe();
  }, [sessionId]);

  return {
    session,
    courtCount,
    sessionMode: getSessionMode(session?.status ?? "active"),
    syncStatus: sync.syncStatus,
    pendingCount: sync.pendingCount,
    blockedCount: sync.blockedCount,
    lastSyncedAt: sync.lastSyncedAt,
    connectionStatus: sync.connectionStatus,
    retry: sync.retry,
    openSyncReview: syncReview.openReview,
    syncReviewPanel: syncReview.panel,
  };
}
