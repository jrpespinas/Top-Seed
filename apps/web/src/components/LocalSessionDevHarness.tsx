import { useCallback, useEffect, useState } from "react";
import { checkInPlayerLocal } from "../mutations/checkInPlayer.js";
import { useLiveSession } from "../hooks/useLiveSession.js";
import { useSyncEngine } from "../hooks/useSyncEngine.js";
import { OfflineBanner } from "./domain/offline-banner.js";
import { SyncStatusBadge } from "./domain/sync-status-badge.js";
import { Button } from "./ui/button.js";
import {
  DEV_SESSION_ID,
  ensureDevSessionSeeded,
  listDevPlayers,
} from "../lib/seedLocalSession.js";
import type { LocalPlayerProfile } from "../db/types.js";

export function LocalSessionDevHarness() {
  const [ready, setReady] = useState(false);
  const [players, setPlayers] = useState<LocalPlayerProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const { session, checkIns } = useLiveSession(DEV_SESSION_ID);
  const sync = useSyncEngine(DEV_SESSION_ID);

  useEffect(() => {
    void (async () => {
      await ensureDevSessionSeeded();
      setPlayers(await listDevPlayers());
      setReady(true);
    })();
  }, []);

  const checkInNext = useCallback(async () => {
    if (!session || busy) {
      return;
    }
    const checkedInIds = new Set(checkIns.map((c) => c.playerProfileId));
    const nextPlayer = players.find((p) => !checkedInIds.has(p.id));
    if (!nextPlayer) {
      return;
    }

    setBusy(true);
    try {
      await checkInPlayerLocal({
        id: crypto.randomUUID(),
        sessionId: session.id,
        playerProfileId: nextPlayer.id,
        playerDisplayName: nextPlayer.displayName,
        arrivalOrder: checkIns.length,
        checkedInAt: new Date().toISOString(),
        sessionSkillRating: nextPlayer.defaultSkillRating,
        paymentAmountDue: session.feeAmount,
      });
      if (sync.connectionStatus === "online") {
        await sync.runSync();
      }
    } finally {
      setBusy(false);
    }
  }, [session, busy, checkIns, players, sync]);

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Loading local session…</p>;
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Local-first dev harness</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Check in players offline — data persists in IndexedDB and syncs when the API is reachable.
      </p>

      <div className="mt-4">
        <OfflineBanner
          connectionStatus={sync.connectionStatus}
          syncStatus={sync.syncStatus}
          pendingCount={sync.pendingCount}
          failedCount={sync.failedCount}
          lastSyncedAt={sync.lastSyncedAt}
          onRetry={() => void sync.retry()}
          onReview={() => undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy || players.length === checkIns.length}
          onClick={() => void checkInNext()}
        >
          Check in next player
        </Button>
        <Button variant="secondary" onClick={() => void sync.runSync()}>
          Sync now
        </Button>
        {import.meta.env.DEV ? (
          <a href="/dev/components" className="text-caption text-primary hover:underline">
            Component gallery →
          </a>
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-border rounded-md border border-border">
        {checkIns.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">No check-ins yet.</li>
        ) : (
          checkIns.map((checkIn) => (
            <li key={checkIn.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                #{checkIn.arrivalOrder + 1} {checkIn.playerDisplayName}
              </span>
              <SyncStatusBadge
                status={checkIn.syncStatus}
                lastError={checkIn.lastSyncError}
                lastSyncedAt={checkIn.lastSyncedAt}
                size="compact"
              />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
