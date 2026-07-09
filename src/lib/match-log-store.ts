"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchRecord } from "@/types";

const STORAGE_KEY = "top-seed:match-log";

function readStoredMatches(): MatchRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MatchRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStoredMatches(matches: MatchRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  } catch {
    // Storage unavailable (private browsing quota, etc.) — this tab keeps working,
    // it just won't persist across a reload until storage is available again.
  }
}

// The native "storage" event only fires in OTHER tabs, never the one that made the
// change — this listener set covers same-tab consumers (e.g. Dashboard and a second
// Matches tab open side by side aren't the same tab, but two hooks in the same tab are).
type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function addMatchRecord(record: MatchRecord) {
  writeStoredMatches([record, ...readStoredMatches()]);
  notifyListeners();
}

export function removeMatchRecord(id: string) {
  writeStoredMatches(readStoredMatches().filter((m) => m.id !== id));
  notifyListeners();
}

/**
 * Bulk purge for a set of sessions — used when their archived SessionRecord
 * is deleted or evicted (see session-store.ts's deleteArchivedSession and the
 * 50-session cap in closeSession) so match history doesn't outlive the
 * record that references it. A no-op for an empty list.
 */
export function removeMatchRecordsForSessions(sessionIds: string[]) {
  if (sessionIds.length === 0) return;
  const idSet = new Set(sessionIds);
  writeStoredMatches(readStoredMatches().filter((m) => !idSet.has(m.sessionId)));
  notifyListeners();
}

export function updateMatchRecord(id: string, patch: Partial<MatchRecord>) {
  writeStoredMatches(
    readStoredMatches().map((m) => (m.id === id ? { ...m, ...patch } : m))
  );
  notifyListeners();
}

export function useMatchLog(): MatchRecord[] {
  // Starts empty on every render pass that has to match the server (both the
  // actual server render and the browser's first hydration pass) — reading
  // localStorage in the initializer would run during that first client render
  // too (window already exists there) and diverge from the server's markup.
  // The effect below corrects to the real value immediately after hydration.
  const [matches, setMatches] = useState<MatchRecord[]>([]);

  useEffect(() => {
    const sync = () => setMatches(readStoredMatches());
    sync(); // pick up anything written before this instance mounted
    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return matches;
}

// Games played is intentionally never stored — it's derived from completed
// match records, consistent with "leaderboard computed at query time"
// (docs/ARCHITECTURE.md). Voided matches don't count, matching docs/PRD.md's
// rule that voided matches are excluded from leaderboard calculations.
export function useGamesPlayedMap(): Map<string, number> {
  const matches = useMatchLog();
  return useMemo(() => {
    const map = new Map<string, number>();
    for (const match of matches) {
      if (match.status !== "COMPLETED") continue;
      for (const player of [...match.sideA, ...match.sideB]) {
        map.set(player.id, (map.get(player.id) ?? 0) + 1);
      }
    }
    return map;
  }, [matches]);
}
