import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/database.js";
import type { LeaderboardEntryDto } from "@top-seed/contracts";
import type {
  LocalCheckIn,
  LocalMatch,
  LocalPlayerProfile,
  LocalSession,
} from "../db/types.js";
import {
  buildClubLeaderboardEntries,
  buildSessionLeaderboardEntries,
  sortLeaderboardEntries,
  type LeaderboardScope,
  type LeaderboardSortKey,
} from "../lib/leaderboard-snapshot.js";

export function useLeaderboard(options: {
  scope: LeaderboardScope;
  sessionId?: string;
  sortKey?: LeaderboardSortKey;
}) {
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [matches, setMatches] = useState<LocalMatch[]>([]);
  const [checkIns, setCheckIns] = useState<LocalCheckIn[]>([]);
  const [profiles, setProfiles] = useState<LocalPlayerProfile[]>([]);

  useEffect(() => {
    const sub = liveQuery(async () => {
      const [sessionRows, matchRows, checkInRows, profileRows] = await Promise.all([
        db.sessions.toArray(),
        db.matches.toArray(),
        db.checkIns.toArray(),
        db.playerProfiles.toArray(),
      ]);
      return { sessions: sessionRows, matches: matchRows, checkIns: checkInRows, profiles: profileRows };
    }).subscribe({
      next: (value) => {
        setSessions(value.sessions);
        setMatches(value.matches);
        setCheckIns(value.checkIns);
        setProfiles(value.profiles);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  const entries: LeaderboardEntryDto[] = useMemo(() => {
    const sortKey = options.sortKey ?? "wins";
    if (options.scope === "session" && options.sessionId) {
      const session = sessions.find((row) => row.id === options.sessionId);
      if (!session) {
        return [];
      }
      const sessionCheckIns = checkIns.filter((row) => row.sessionId === options.sessionId);
      const sessionMatches = matches.filter((row) => row.sessionId === options.sessionId);
      return sortLeaderboardEntries(
        buildSessionLeaderboardEntries(session, sessionMatches, sessionCheckIns, profiles),
        sortKey,
      );
    }
    return sortLeaderboardEntries(
      buildClubLeaderboardEntries(sessions, matches, checkIns, profiles),
      sortKey,
    );
  }, [sessions, matches, checkIns, profiles, options.scope, options.sessionId, options.sortKey]);

  return { entries, sessions };
}
