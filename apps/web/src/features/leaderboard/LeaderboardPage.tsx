import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { liveQuery } from "dexie";
import { db } from "../../db/database.js";
import { useLeaderboard } from "../../hooks/useLeaderboard.js";
import { LeaderboardPageHeader, LeaderboardView } from "./LeaderboardView.js";
import { PlayerDetailDrawer } from "../players/PlayerDetailDrawer.js";
import type { LeaderboardScope, LeaderboardSortKey } from "../../lib/leaderboard-snapshot.js";

export function LeaderboardPage() {
  const search = useSearch({ from: "/organizer/leaderboard" });
  const sessionId = search.sessionId;
  const [scope, setScope] = useState<LeaderboardScope>(sessionId ? "session" : "club");
  const [sortKey, setSortKey] = useState<LeaderboardSortKey>("wins");
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);
  const [checkInByPlayer, setCheckInByPlayer] = useState<Map<string, string>>(new Map());

  const { entries } = useLeaderboard({ scope, sessionId, sortKey });

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const sub = liveQuery(async () => {
      const rows = await db.checkIns.where("sessionId").equals(sessionId).toArray();
      return new Map(rows.map((row) => [row.playerProfileId, row.id]));
    }).subscribe({
      next: (value) => setCheckInByPlayer(value),
    });
    return () => sub.unsubscribe();
  }, [sessionId]);

  const openPlayer = useMemo(
    () => (playerProfileId: string) => {
      if (!sessionId) {
        return;
      }
      const checkInId = checkInByPlayer.get(playerProfileId);
      if (checkInId) {
        setSelectedCheckInId(checkInId);
      }
    },
    [checkInByPlayer, sessionId],
  );

  return (
    <div className="space-y-4">
      <LeaderboardPageHeader sessionId={sessionId} />
      <LeaderboardView
        entries={entries}
        scope={scope}
        sortKey={sortKey}
        onScopeChange={setScope}
        onSortChange={setSortKey}
        onOpenPlayer={sessionId ? openPlayer : undefined}
      />
      {sessionId ? (
        <PlayerDetailDrawer
          sessionId={sessionId}
          checkInId={selectedCheckInId}
          isOpen={selectedCheckInId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCheckInId(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
