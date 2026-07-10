"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  QueueEntry,
  BenchEntry,
  Player,
  SkillLevel,
  Gender,
  Court,
  PlanningCard,
  MatchRecord,
  CurrentSession,
  SessionRecord,
  SessionPlayerSnapshot,
} from "@/types";
import { getDefaultSessionName } from "@/lib/utils";

const QUEUE_KEY = "top-seed:session-queue";
const BENCH_KEY = "top-seed:session-bench";
const COURTS_KEY = "top-seed:session-courts";
const PLANNING_CARDS_KEY = "top-seed:session-planning-cards";
const CURRENT_SESSION_KEY = "top-seed:current-session";
const SESSION_ARCHIVE_KEY = "top-seed:sessions";
// Keeps the archive itself small (~4KB/session) and bounds the far larger,
// separately-stored match log (match-log-store.ts) from growing forever —
// closeSession purges evicted sessions' matches via the caller (page.tsx),
// same decoupled-stores handoff this file already uses for `matches`.
const MAX_ARCHIVED_SESSIONS = 50;
const SKIP_COUNTS_KEY = "top-seed:smart-matchup-skip-counts";

function readListOrNull<T>(key: string): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : null;
  } catch {
    return null;
  }
}

function writeList<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage unavailable — this tab keeps working, just won't persist/sync.
  }
}

function readOrNull<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeOrNull<T>(key: string, value: T | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — this tab keeps working, just won't persist/sync.
  }
}

type Listener = () => void;
const queueListeners = new Set<Listener>();
const benchListeners = new Set<Listener>();
const courtsListeners = new Set<Listener>();
const planningCardsListeners = new Set<Listener>();
const currentSessionListeners = new Set<Listener>();
const sessionArchiveListeners = new Set<Listener>();
const skipCountsListeners = new Set<Listener>();
const selectedSessionListeners = new Set<Listener>();

// Deliberately in-memory only, not localStorage-backed like the stores above
// — this is shared UI navigation state (which session Leaderboard/Matches are
// currently viewing), the same category as sort/search/filter state, which
// this app never persists across a refresh. Shared across components via the
// same listener pattern so the two pages stay in sync within a tab.
let selectedSessionId: string | null = null;

type Updater<T> = T | ((prev: T) => T);
function resolve<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
}

// The queue is strict FIFO: players re-entering (from a finished match, the bench,
// or an undone assignment) always go to the back of the line, never ahead of anyone
// already queued. When several enter together, the earliest check-in within that
// batch leads.
export function appendSortedByCheckIn(queue: QueueEntry[], newEntries: QueueEntry[]): QueueEntry[] {
  const sortedNew = [...newEntries].sort((a, b) => a.sessionJoinedAt.localeCompare(b.sessionJoinedAt));
  return [...queue, ...sortedNew].map((e, i) => ({ ...e, position: i + 1 }));
}

/** Owner hook — the Dashboard reads and writes the live session queue. */
export function useSessionQueue(
  seed: QueueEntry[]
): [QueueEntry[], (updater: Updater<QueueEntry[]>) => void] {
  // Starts as `seed` (deterministic, usually []) on every render pass that has
  // to match the server — reading real localStorage in the initializer would
  // run during the browser's first hydration render too and diverge from the
  // server's markup if the stored queue differs. The effect below corrects to
  // the real, persisted queue immediately after hydration, seeding storage
  // only if this is genuinely the first-ever load.
  const [queue, setQueueState] = useState<QueueEntry[]>(seed);
  // Tracks the same value as `queue`, but readable/writable synchronously
  // outside React's render cycle — see setQueue below for why this matters.
  const queueRef = useRef<QueueEntry[]>(seed);

  useEffect(() => {
    const stored = readListOrNull<QueueEntry>(QUEUE_KEY);
    if (stored) {
      queueRef.current = stored;
      setQueueState(stored);
    } else {
      writeList(QUEUE_KEY, seed);
    }

    const sync = () => {
      const s = readListOrNull<QueueEntry>(QUEUE_KEY);
      if (s) {
        queueRef.current = s;
        setQueueState(s);
      }
    };
    queueListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      queueListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deliberately NOT `setQueueState((prev) => { ...side effects...; return next; })`:
  // a function passed to a state setter must be pure. React 18 StrictMode
  // intentionally invokes updater functions twice in development to catch
  // exactly this kind of impurity — an updater that writes to localStorage and
  // notifies listeners gets those side effects run twice, silently double-adding
  // whatever was just appended. Computing `next` here, outside any function React
  // might re-invoke, and passing setQueueState a plain value closes that hole.
  const setQueue = useCallback((updater: Updater<QueueEntry[]>) => {
    const next = resolve(updater, queueRef.current);
    queueRef.current = next;
    writeList(QUEUE_KEY, next);
    setQueueState(next);
    queueListeners.forEach((l) => l());
  }, []);

  return [queue, setQueue];
}

/** Owner hook — the Dashboard reads and writes the live session bench. */
export function useSessionBench(
  seed: BenchEntry[]
): [BenchEntry[], (updater: Updater<BenchEntry[]>) => void] {
  // See useSessionQueue above for why this starts as `seed` rather than
  // reading localStorage directly in the initializer.
  const [bench, setBenchState] = useState<BenchEntry[]>(seed);
  const benchRef = useRef<BenchEntry[]>(seed);

  useEffect(() => {
    const stored = readListOrNull<BenchEntry>(BENCH_KEY);
    if (stored) {
      benchRef.current = stored;
      setBenchState(stored);
    } else {
      writeList(BENCH_KEY, seed);
    }

    const sync = () => {
      const s = readListOrNull<BenchEntry>(BENCH_KEY);
      if (s) {
        benchRef.current = s;
        setBenchState(s);
      }
    };
    benchListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      benchListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // See setQueue's comment above — same StrictMode-double-invoke hazard, same fix.
  const setBench = useCallback((updater: Updater<BenchEntry[]>) => {
    const next = resolve(updater, benchRef.current);
    benchRef.current = next;
    writeList(BENCH_KEY, next);
    setBenchState(next);
    benchListeners.forEach((l) => l());
  }, []);

  return [bench, setBench];
}

/** Owner hook — the Dashboard reads and writes the live courts. */
export function useSessionCourts(
  seed: Court[]
): [Court[], (updater: Updater<Court[]>) => void] {
  // See useSessionQueue above for why this starts as `seed` rather than
  // reading localStorage directly in the initializer.
  const [courts, setCourtsState] = useState<Court[]>(seed);
  const courtsRef = useRef<Court[]>(seed);

  useEffect(() => {
    const stored = readListOrNull<Court>(COURTS_KEY);
    if (stored) {
      courtsRef.current = stored;
      setCourtsState(stored);
    } else {
      writeList(COURTS_KEY, seed);
    }

    const sync = () => {
      const s = readListOrNull<Court>(COURTS_KEY);
      if (s) {
        courtsRef.current = s;
        setCourtsState(s);
      }
    };
    courtsListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      courtsListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // See setQueue's comment above — same StrictMode-double-invoke hazard, same fix.
  const setCourts = useCallback((updater: Updater<Court[]>) => {
    const next = resolve(updater, courtsRef.current);
    courtsRef.current = next;
    writeList(COURTS_KEY, next);
    setCourtsState(next);
    courtsListeners.forEach((l) => l());
  }, []);

  return [courts, setCourts];
}

/** Read-only snapshot — SessionHeader computes court counts without owning them. */
export function useCourtsSnapshot(): Court[] {
  // Starts empty deterministically — see useSessionQueue above for why.
  const [courts, setCourts] = useState<Court[]>([]);
  useEffect(() => {
    const sync = () => setCourts(readListOrNull<Court>(COURTS_KEY) ?? []);
    sync();
    courtsListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      courtsListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return courts;
}

/** Owner hook — the Dashboard reads and writes the live matchup planning cards. */
export function useSessionPlanningCards(
  seed: PlanningCard[]
): [PlanningCard[], (updater: Updater<PlanningCard[]>) => void] {
  // See useSessionQueue above for why this starts as `seed` rather than
  // reading localStorage directly in the initializer.
  const [cards, setCardsState] = useState<PlanningCard[]>(seed);
  const cardsRef = useRef<PlanningCard[]>(seed);

  useEffect(() => {
    const stored = readListOrNull<PlanningCard>(PLANNING_CARDS_KEY);
    if (stored) {
      cardsRef.current = stored;
      setCardsState(stored);
    } else {
      writeList(PLANNING_CARDS_KEY, seed);
    }

    const sync = () => {
      const s = readListOrNull<PlanningCard>(PLANNING_CARDS_KEY);
      if (s) {
        cardsRef.current = s;
        setCardsState(s);
      }
    };
    planningCardsListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      planningCardsListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // See setQueue's comment above — same StrictMode-double-invoke hazard, same fix.
  const setCards = useCallback((updater: Updater<PlanningCard[]>) => {
    const next = resolve(updater, cardsRef.current);
    cardsRef.current = next;
    writeList(PLANNING_CARDS_KEY, next);
    setCardsState(next);
    planningCardsListeners.forEach((l) => l());
  }, []);

  return [cards, setCards];
}

/**
 * Owner hook — Smart Suggest's fairness backstop (docs/specs/07-smart-matchup.md).
 * playerId -> consecutive times skipped, session-scoped.
 */
export function useSmartMatchupSkipCounts(): [
  Record<string, number>,
  (updater: Updater<Record<string, number>>) => void
] {
  const [skipCounts, setSkipCountsState] = useState<Record<string, number>>({});
  const skipCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const stored = readOrNull<Record<string, number>>(SKIP_COUNTS_KEY);
    if (stored) {
      skipCountsRef.current = stored;
      setSkipCountsState(stored);
    } else {
      writeOrNull(SKIP_COUNTS_KEY, {});
    }

    const sync = () => {
      const s = readOrNull<Record<string, number>>(SKIP_COUNTS_KEY);
      if (s) {
        skipCountsRef.current = s;
        setSkipCountsState(s);
      }
    };
    skipCountsListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      skipCountsListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // See setQueue's comment above — same StrictMode-double-invoke hazard, same fix.
  const setSkipCounts = useCallback((updater: Updater<Record<string, number>>) => {
    const next = resolve(updater, skipCountsRef.current);
    skipCountsRef.current = next;
    writeOrNull(SKIP_COUNTS_KEY, next);
    setSkipCountsState(next);
    skipCountsListeners.forEach((l) => l());
  }, []);

  return [skipCounts, setSkipCounts];
}

// PRD default: every fresh session starts with 3 blank matchup cards; the
// organizer can add or dismiss more during the session.
export function buildDefaultPlanningCards(): PlanningCard[] {
  return Array.from({ length: 3 }, (_, i) => ({
    id: `pc-${Date.now()}-${i}`,
    matchType: "DOUBLES" as const,
    state: "empty" as const,
    suggestion: null,
  }));
}

/**
 * Read-only snapshot for consumers that don't own the session (e.g. the
 * Players page showing live check-in presence without ever seeding or
 * mutating the queue/bench itself).
 */
export function useQueueSnapshot(): QueueEntry[] {
  // Starts empty deterministically — see useSessionQueue above for why.
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  useEffect(() => {
    const sync = () => setQueue(readListOrNull<QueueEntry>(QUEUE_KEY) ?? []);
    sync();
    queueListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      queueListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return queue;
}

export function useBenchSnapshot(): BenchEntry[] {
  // Starts empty deterministically — see useSessionQueue above for why.
  const [bench, setBench] = useState<BenchEntry[]>([]);
  useEffect(() => {
    const sync = () => setBench(readListOrNull<BenchEntry>(BENCH_KEY) ?? []);
    sync();
    benchListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      benchListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return bench;
}

// The functions below let non-owner consumers (the Players page, which never
// mounts useSessionQueue/useSessionBench) mutate the live session without
// racing the Dashboard's own state. Each reads the current persisted list,
// writes the result, and notifies listeners — the same pattern the old
// player-store.ts used for createPlayer/updatePlayer before the roster was
// folded into the session itself.

/** Players page "Add Player" — enters a brand-new player straight into the queue. */
export function addPlayerToQueue(data: {
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  notes?: string;
}): QueueEntry {
  const now = new Date().toISOString();
  const entry: QueueEntry = {
    id: `q-${Date.now()}`,
    position: 0,
    player: {
      id: `p-${Date.now()}`,
      name: data.name,
      skillLevel: data.skillLevel,
      gender: data.gender,
      notes: data.notes,
      paymentStatus: "UNPAID",
    },
    isInMatch: false,
    sessionJoinedAt: now,
    enteredQueueAt: now,
  };
  const current = readListOrNull<QueueEntry>(QUEUE_KEY) ?? [];
  writeList(QUEUE_KEY, appendSortedByCheckIn(current, [entry]));
  queueListeners.forEach((l) => l());
  return entry;
}

type PlayerEditPatch = Partial<Pick<Player, "name" | "skillLevel" | "gender" | "notes" | "paymentStatus">>;

/** Players page "Edit Player" — updates the embedded player in place within a queue entry. */
export function updateQueuePlayer(entryId: string, patch: PlayerEditPatch) {
  const current = readListOrNull<QueueEntry>(QUEUE_KEY) ?? [];
  writeList(
    QUEUE_KEY,
    current.map((e) => (e.id === entryId ? { ...e, player: { ...e.player, ...patch } } : e))
  );
  queueListeners.forEach((l) => l());
}

/** Players page "Edit Player" — updates the embedded player in place within a bench entry. */
export function updateBenchPlayer(entryId: string, patch: PlayerEditPatch) {
  const current = readListOrNull<BenchEntry>(BENCH_KEY) ?? [];
  writeList(
    BENCH_KEY,
    current.map((e) => (e.id === entryId ? { ...e, player: { ...e.player, ...patch } } : e))
  );
  benchListeners.forEach((l) => l());
}

/** Players page "Remove from session" — pulls the entry out of the queue; returns it for undo. */
export function removeQueueEntry(entryId: string): QueueEntry | null {
  const current = readListOrNull<QueueEntry>(QUEUE_KEY) ?? [];
  const removed = current.find((e) => e.id === entryId) ?? null;
  if (!removed) return null;
  writeList(
    QUEUE_KEY,
    current.filter((e) => e.id !== entryId).map((e, i) => ({ ...e, position: i + 1 }))
  );
  queueListeners.forEach((l) => l());
  return removed;
}

/** Players page "Remove from session" — pulls the entry out of the bench; returns it for undo. */
export function removeBenchEntry(entryId: string): BenchEntry | null {
  const current = readListOrNull<BenchEntry>(BENCH_KEY) ?? [];
  const removed = current.find((e) => e.id === entryId) ?? null;
  if (!removed) return null;
  writeList(BENCH_KEY, current.filter((e) => e.id !== entryId));
  benchListeners.forEach((l) => l());
  return removed;
}

/** Undo for removeQueueEntry — re-enters at the correct FIFO position for its original check-in time. */
export function restoreQueueEntry(entry: QueueEntry) {
  const current = readListOrNull<QueueEntry>(QUEUE_KEY) ?? [];
  writeList(QUEUE_KEY, appendSortedByCheckIn(current, [entry]));
  queueListeners.forEach((l) => l());
}

/** Undo for removeBenchEntry — bench is unordered, so this just re-appends. */
export function restoreBenchEntry(entry: BenchEntry) {
  const current = readListOrNull<BenchEntry>(BENCH_KEY) ?? [];
  writeList(BENCH_KEY, [...current, entry]);
  benchListeners.forEach((l) => l());
}

// ── Session lifecycle ──────────────────────────────────────────────────────
// There is at most one open session at a time (CurrentSession, a thin
// pointer). Closing it snapshots the live queue/bench/courts/matches into a
// permanent SessionRecord and clears the board for the next one.

/** Read-only — the page shell uses this to decide NoSessionState vs. the live Dashboard. */
export function useCurrentSession(): CurrentSession | null {
  // Starts null deterministically — see useSessionQueue above for why.
  const [session, setSession] = useState<CurrentSession | null>(null);
  useEffect(() => {
    const sync = () => setSession(readOrNull<CurrentSession>(CURRENT_SESSION_KEY));
    sync();
    currentSessionListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      currentSessionListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return session;
}

/** Read-only — the /sessions pages list and look up past sessions. */
export function useSessionArchive(): SessionRecord[] {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  useEffect(() => {
    const sync = () => setRecords(readListOrNull<SessionRecord>(SESSION_ARCHIVE_KEY) ?? []);
    sync();
    sessionArchiveListeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      sessionArchiveListeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return records;
}

export interface SessionOption {
  id: string;
  label: string;
  date: string; // ISO — secondary text, disambiguates same-named sessions
  isOpen: boolean;
}

/**
 * Shared by Leaderboard and Matches — the open session (if any) followed by
 * the archive newest-first, plus a selection that defaults to the open
 * session or the most recent closed one, exactly once post-hydration. Never
 * re-defaults after that: closing the currently-viewed session moves it from
 * `currentSession` into `archive` under the same id, so the selection stays
 * valid and the view doesn't jump out from under whoever's looking at it.
 */
export function useSessionOptions(): {
  sessions: SessionOption[];
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string) => void;
} {
  const currentSession = useCurrentSession();
  const archive = useSessionArchive();
  const [selected, setSelected] = useState<string | null>(selectedSessionId);

  useEffect(() => {
    const sync = () => setSelected(selectedSessionId);
    selectedSessionListeners.add(sync);
    return () => {
      selectedSessionListeners.delete(sync);
    };
  }, []);

  const setSelectedSessionId = useCallback((id: string) => {
    selectedSessionId = id;
    selectedSessionListeners.forEach((l) => l());
  }, []);

  const sessions = useMemo<SessionOption[]>(() => {
    const openOption: SessionOption[] = currentSession
      ? [{ id: currentSession.id, label: currentSession.name, date: currentSession.date, isOpen: true }]
      : [];
    const closedOptions: SessionOption[] = archive.map((r) => ({
      id: r.id,
      label: r.name,
      date: r.date,
      isOpen: false,
    }));
    return [...openOption, ...closedOptions];
  }, [currentSession, archive]);

  // Defaults to the open session, or the most recent closed one — only once,
  // the first time either becomes available. Shared across every mounted
  // instance via the module-level variable, so whichever page loads first
  // decides the default and the other one just sees it already set.
  useEffect(() => {
    if (selectedSessionId !== null) return;
    if (sessions.length > 0) setSelectedSessionId(sessions[0].id);
  }, [sessions, setSelectedSessionId]);

  return { sessions, selectedSessionId: selected, setSelectedSessionId };
}

/**
 * Settings "Clear session history" — wipes only the closed-session archive.
 * Deliberately narrower than the full data reset: the currently open session
 * (if any) and its live queue/bench/courts/matches are untouched. Returns the
 * cleared session ids so the caller can also purge their match records (see
 * removeMatchRecordsForSessions in match-log-store.ts) — this file never
 * imports match-log-store, to keep the two stores decoupled.
 */
export function clearSessionArchive(): string[] {
  const archive = readListOrNull<SessionRecord>(SESSION_ARCHIVE_KEY) ?? [];
  writeList(SESSION_ARCHIVE_KEY, []);
  sessionArchiveListeners.forEach((l) => l());
  return archive.map((r) => r.id);
}

/**
 * Sessions page inline delete — permanently removes one archived session.
 * Returns the removed record's id (for the caller to also purge its match
 * records), or null if it was already gone.
 */
export function deleteArchivedSession(sessionId: string): string | null {
  const archive = readListOrNull<SessionRecord>(SESSION_ARCHIVE_KEY) ?? [];
  const removed = archive.find((r) => r.id === sessionId);
  if (!removed) return null;
  writeList(SESSION_ARCHIVE_KEY, archive.filter((r) => r.id !== sessionId));
  sessionArchiveListeners.forEach((l) => l());
  return removed.id;
}

/** Dashboard's "Start Session" — clean slate: empty courts/queue/bench, 3 blank planning cards. */
export function startSession(name: string): CurrentSession {
  const trimmed = name.trim();
  const session: CurrentSession = {
    id: `sess-${Date.now()}`,
    name: trimmed.length > 0 ? trimmed : getDefaultSessionName(),
    date: new Date().toISOString(),
  };
  writeOrNull(CURRENT_SESSION_KEY, session);
  writeList(QUEUE_KEY, []);
  writeList(BENCH_KEY, []);
  writeList(COURTS_KEY, []);
  writeList(PLANNING_CARDS_KEY, buildDefaultPlanningCards());
  writeOrNull(SKIP_COUNTS_KEY, {});

  currentSessionListeners.forEach((l) => l());
  queueListeners.forEach((l) => l());
  benchListeners.forEach((l) => l());
  courtsListeners.forEach((l) => l());
  planningCardsListeners.forEach((l) => l());
  skipCountsListeners.forEach((l) => l());

  return session;
}

/**
 * SessionHeader's inline rename — open session only. Closed sessions are a
 * frozen SessionRecord snapshot (see closeSession), so there's nothing to
 * rename once archived.
 */
export function renameSession(name: string): CurrentSession | null {
  const current = readOrNull<CurrentSession>(CURRENT_SESSION_KEY);
  if (!current) return null;

  const trimmed = name.trim();
  const updated: CurrentSession = {
    ...current,
    name: trimmed.length > 0 ? trimmed : getDefaultSessionName(),
  };
  writeOrNull(CURRENT_SESSION_KEY, updated);
  currentSessionListeners.forEach((l) => l());
  return updated;
}

export interface CloseSessionResult {
  record: SessionRecord;
  /** Session ids dropped by the 50-session cap — caller purges their matches. */
  evictedSessionIds: string[];
}

/**
 * Dashboard's "Close Session" — archives a frozen snapshot (who played, what
 * they paid, how many matches/courts) then clears the board back to
 * NoSessionState. `matches` comes from the caller's own useMatchLog() call —
 * this file never imports match-log-store, to keep the two stores decoupled.
 */
export function closeSession(matches: MatchRecord[]): CloseSessionResult | null {
  const current = readOrNull<CurrentSession>(CURRENT_SESSION_KEY);
  if (!current) return null;

  const queue = readListOrNull<QueueEntry>(QUEUE_KEY) ?? [];
  const bench = readListOrNull<BenchEntry>(BENCH_KEY) ?? [];
  const courts = readListOrNull<Court>(COURTS_KEY) ?? [];

  const playersById = new Map<string, SessionPlayerSnapshot>();
  for (const entry of [...queue, ...bench]) {
    const { id, name, skillLevel, gender, paymentStatus } = entry.player;
    playersById.set(id, { id, name, skillLevel, gender, paymentStatus });
  }

  const matchCount = matches.filter(
    (m) => m.sessionId === current.id && m.status === "COMPLETED"
  ).length;

  const record: SessionRecord = {
    id: current.id,
    name: current.name,
    date: current.date,
    closedAt: new Date().toISOString(),
    players: Array.from(playersById.values()),
    matchCount,
    courtCount: courts.length,
  };

  const archive = readListOrNull<SessionRecord>(SESSION_ARCHIVE_KEY) ?? [];
  const combinedArchive = [record, ...archive];
  const evictedSessionIds = combinedArchive.slice(MAX_ARCHIVED_SESSIONS).map((r) => r.id);
  writeList(SESSION_ARCHIVE_KEY, combinedArchive.slice(0, MAX_ARCHIVED_SESSIONS));

  writeOrNull(CURRENT_SESSION_KEY, null);
  writeList(QUEUE_KEY, []);
  writeList(BENCH_KEY, []);
  writeList(COURTS_KEY, []);
  writeList(PLANNING_CARDS_KEY, []);
  writeOrNull(SKIP_COUNTS_KEY, {});

  sessionArchiveListeners.forEach((l) => l());
  currentSessionListeners.forEach((l) => l());
  queueListeners.forEach((l) => l());
  benchListeners.forEach((l) => l());
  courtsListeners.forEach((l) => l());
  planningCardsListeners.forEach((l) => l());
  skipCountsListeners.forEach((l) => l());

  return { record, evictedSessionIds };
}
