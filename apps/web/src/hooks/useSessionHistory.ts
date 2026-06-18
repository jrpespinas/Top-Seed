import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/database.js";
import type { LocalCheckIn, LocalCourt, LocalMatch, LocalSession } from "../db/types.js";
import { getSessionMode } from "../lib/session-mode.js";

export type HistoryFilter = "all" | "wins_losses" | "draws" | "unscored" | "cancelled";

export function useSessionHistory(sessionId: string) {
  const [session, setSession] = useState<LocalSession | undefined>();
  const [matches, setMatches] = useState<LocalMatch[]>([]);
  const [courts, setCourts] = useState<LocalCourt[]>([]);
  const [checkIns, setCheckIns] = useState<LocalCheckIn[]>([]);

  useEffect(() => {
    const sub = liveQuery(async () => {
      const [sessionRow, matchRows, courtRows, checkInRows] = await Promise.all([
        db.sessions.get(sessionId),
        db.matches.where("sessionId").equals(sessionId).toArray(),
        db.courts.where("sessionId").equals(sessionId).toArray(),
        db.checkIns.where("sessionId").equals(sessionId).toArray(),
      ]);
      return { session: sessionRow, matches: matchRows, courts: courtRows, checkIns: checkInRows };
    }).subscribe({
      next: (value) => {
        setSession(value.session);
        setMatches(value.matches);
        setCourts(value.courts);
        setCheckIns(value.checkIns);
      },
    });
    return () => sub.unsubscribe();
  }, [sessionId]);

  const sessionMode = session ? getSessionMode(session.status) : "ended";

  const historyMatches = useMemo(() => {
    return [...matches]
      .filter((match) => match.status === "completed" || match.status === "cancelled")
      .sort((a, b) => (b.completedAt ?? b.endedAt ?? "").localeCompare(a.completedAt ?? a.endedAt ?? ""));
  }, [matches]);

  return { session, matches: historyMatches, courts, checkIns, sessionMode };
}

export function filterHistoryMatches(matches: LocalMatch[], filter: HistoryFilter): LocalMatch[] {
  if (filter === "all") {
    return matches;
  }
  if (filter === "cancelled") {
    return matches.filter((match) => match.status === "cancelled" || match.outcome === "cancelled");
  }
  if (filter === "draws") {
    return matches.filter((match) => match.outcome === "draw");
  }
  if (filter === "unscored") {
    return matches.filter((match) => match.outcome === "unscored");
  }
  return matches.filter(
    (match) => match.outcome === "team_one_win" || match.outcome === "team_two_win",
  );
}
