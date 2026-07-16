export type SkillLevel = "F" | "E" | "D" | "C" | "B" | "A" | "S";
export type MatchType = "SINGLES" | "DOUBLES";
export type MatchStatus = "IN_PROGRESS" | "COMPLETED" | "VOIDED";
export type MatchResult = "SIDE_A" | "SIDE_B" | "DRAW";
export type CourtStatus = "AVAILABLE" | "IN_USE";
export type SessionStatus = "OPEN" | "CLOSED";
export type PaymentStatus = "PAID" | "UNPAID" | "WAIVED";
export type Gender = "M" | "F";
export type Side = "A" | "B";

export interface Player {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  notes?: string;
  // Manual, no-gateway ledger for this session only — see docs/specs/01-player-management.md.
  paymentStatus: PaymentStatus;
}

export interface ActiveMatch {
  id: string;
  courtId: string | null;
  courtName: string;
  matchType: MatchType;
  sideA: Player[];
  sideB: Player[];
  startedAt: string; // ISO string — safe to pass server → client
  // Each player's sessionJoinedAt at the moment they were pulled off the queue,
  // preserved here since ActiveMatch only holds bare Player[]. Used to restore
  // the correct FIFO position when the match ends or is voided.
  sessionJoinedAtByPlayer: Record<string, string>;
}

export interface Court {
  id: string;
  number: number;
  status: CourtStatus;
  activeMatch?: ActiveMatch;
}

export interface QueueEntry {
  id: string;
  position: number;
  player: Player;
  isInMatch: boolean;
  // Set once when this player first enters the session's queue or bench;
  // never reset on re-queue. Drives FIFO re-entry order — see DashboardClient's
  // appendSortedByCheckIn.
  sessionJoinedAt: string;
  // Set every time this entry is (re-)created — a match ending, a bench
  // return, a fresh add, or an assignment being undone. Unlike sessionJoinedAt,
  // this resets on every re-entry; it drives the "waiting time" display, which
  // means "how long in the current queue position," not total session time.
  enteredQueueAt: string;
}

export interface BenchEntry {
  id: string;
  player: Player;
  sessionJoinedAt: string;
}

export type PlanningCardState = "empty" | "proposed" | "ready";

export interface MatchupSuggestion {
  sideA: (Player | null)[];
  sideB: (Player | null)[];
  pairsExhausted: boolean;
}

export interface PlanningCard {
  id: string;
  matchType: MatchType;
  state: PlanningCardState;
  suggestion: MatchupSuggestion | null;
}

export interface MatchRecord {
  id: string;
  // Which session this match was played in. Matches recorded before this field
  // existed won't have one — the Matches page still shows everything regardless
  // of session (see docs/specs), only session close's matchCount snapshot cares.
  sessionId: string;
  courtName: string;
  matchType: MatchType;
  sideA: Player[];
  sideB: Player[];
  result: MatchResult | null;
  status: MatchStatus;
  startedAt: string;
  endedAt: string | null;
  // Snapshot of `result` immediately before this record was voided, so a
  // later Restore can bring back the original result rather than leaving it
  // permanently null. Absent for matches voided directly from an in-progress
  // state on the Dashboard, which never had a result to begin with.
  previousResult?: MatchResult | null;
}

// The live, currently-open session — a thin pointer. There is at most one of
// these; playerCount/courts/matches are computed live from the session stores,
// never stored here (they'd immediately go stale).
export interface CurrentSession {
  id: string;
  name: string;
  date: string; // ISO, when started
}

// A frozen record of who played and what they paid, taken the moment a
// session closes. Not a live roster — see docs/specs/01-player-management.md
// on why players themselves aren't a persistent cross-session entity; this is
// purely historical.
export interface SessionPlayerSnapshot {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  paymentStatus: PaymentStatus;
  // Optional — snapshots taken before this field existed won't have one;
  // consumers must handle its absence, not assume it. When present, the
  // player's original check-in time for this session (from QueueEntry/
  // BenchEntry.sessionJoinedAt), preserved so it's still visible after close.
  sessionJoinedAt?: string;
}

export interface SessionRecord {
  id: string;
  name: string;
  date: string; // ISO, when started
  closedAt: string; // ISO, when closed
  players: SessionPlayerSnapshot[];
  matchCount: number;
  courtCount: number;
}
