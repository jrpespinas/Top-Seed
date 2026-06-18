import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/database.js";
import type { LocalCheckIn, LocalMatch, LocalPlayerProfile, LocalSession } from "../db/types.js";
import { getSessionMode } from "../lib/session-mode.js";
import { computeSessionPlayerStats } from "../lib/session-stats.js";

export function usePlayerDetail(sessionId: string, checkInId: string | null) {
  const [checkIn, setCheckIn] = useState<LocalCheckIn | undefined>();
  const [session, setSession] = useState<LocalSession | undefined>();
  const [profile, setProfile] = useState<LocalPlayerProfile | undefined>();
  const [matches, setMatches] = useState<LocalMatch[]>([]);
  const [profiles, setProfiles] = useState<LocalPlayerProfile[]>([]);

  useEffect(() => {
    if (!checkInId) {
      setCheckIn(undefined);
      return;
    }
    const sub = liveQuery(async () => {
      const row = await db.checkIns.get(checkInId);
      if (!row) {
        return { checkIn: undefined, session: undefined, profile: undefined, matches: [], profiles: [] };
      }
      const [sessionRow, profileRow, sessionMatches, allProfiles] = await Promise.all([
        db.sessions.get(sessionId),
        db.playerProfiles.get(row.playerProfileId),
        db.matches.where("sessionId").equals(sessionId).toArray(),
        db.playerProfiles.toArray(),
      ]);
      return {
        checkIn: row,
        session: sessionRow,
        profile: profileRow,
        matches: sessionMatches,
        profiles: allProfiles,
      };
    }).subscribe({
      next: (value) => {
        setCheckIn(value.checkIn);
        setSession(value.session);
        setProfile(value.profile);
        setMatches(value.matches);
        setProfiles(value.profiles);
      },
    });
    return () => sub.unsubscribe();
  }, [checkInId, sessionId]);

  const sessionMode = session ? getSessionMode(session.status) : "ended";
  const statsMap = useMemo(() => {
    if (!session) {
      return new Map();
    }
    return computeSessionPlayerStats(
      sessionId,
      matches,
      checkIn ? [checkIn] : [],
      profiles,
      session.ratingMode,
    );
  }, [session, sessionId, matches, checkIn, profiles]);

  return { checkIn, session, profile, sessionMode, statsMap };
}
