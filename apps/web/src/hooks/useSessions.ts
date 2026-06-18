import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/database.js";
import type { LocalSession } from "../db/types.js";

export type SessionFilter = "all" | "active" | "completed";

const ACTIVE_STATUSES = new Set(["draft", "open", "active"]);

function matchesFilter(session: LocalSession, filter: SessionFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "active") {
    return ACTIVE_STATUSES.has(session.status);
  }
  return session.status === "completed" || session.status === "cancelled";
}

export function useSessions(filter: SessionFilter = "all") {
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [checkInCounts, setCheckInCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const sub = liveQuery(async () => {
      const all = await db.sessions.toArray();
      return all
        .filter((session) => matchesFilter(session, filter))
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    }).subscribe({
      next: (value) => setSessions(value),
    });
    return () => sub.unsubscribe();
  }, [filter]);

  useEffect(() => {
    const sub = liveQuery(async () => {
      const counts: Record<string, number> = {};
      for (const session of sessions) {
        counts[session.id] = await db.checkIns.where("sessionId").equals(session.id).count();
      }
      return counts;
    }).subscribe({
      next: (value) => setCheckInCounts(value),
    });
    return () => sub.unsubscribe();
  }, [sessions]);

  return { sessions, checkInCounts };
}

export function useSession(sessionId: string | undefined) {
  const [session, setSession] = useState<LocalSession | undefined>();

  useEffect(() => {
    if (!sessionId) {
      setSession(undefined);
      return;
    }
    const sub = liveQuery(() => db.sessions.get(sessionId)).subscribe({
      next: (value) => setSession(value),
    });
    return () => sub.unsubscribe();
  }, [sessionId]);

  return session;
}
