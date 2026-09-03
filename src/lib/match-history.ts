import type { MatchRecord } from "@/types";
import { matchUpset } from "./leaderboard";

/**
 * How long a match ran, or null when it can't be known.
 *
 * `endedAt` is nullable — a match voided directly from an in-progress state
 * never got one. Returning null rather than 0 matters: the UI must omit the
 * duration entirely for those, because "0m" would read as a real, absurdly
 * short match rather than as an absence.
 */
export function matchDurationMs(match: MatchRecord): number | null {
  if (!match.endedAt) return null;
  const ms = new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime();
  return ms > 0 ? ms : null;
}

/** "24m" / "1h 04m". Distinct from `formatElapsedMs`, which is mm:ss for live timers. */
export function formatDurationMs(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${totalMinutes}m`;
}

/**
 * A "long" match is long *relative to this session*, not against a constant.
 *
 * Same reasoning as `ElapsedTimer`'s peer-median wait threshold: a 25-minute
 * match is unremarkable in a session of 30-minute games and a marathon in a
 * session of 10-minute ones. A fixed constant would fire on every match some
 * nights and none on others, which makes the marker noise rather than signal.
 */
export const LONG_MATCH_MULTIPLIER = 1.5;

/** Below this, a session is too short-form for the multiplier to mean anything. */
const LONG_MATCH_FLOOR_MS = 10 * 60 * 1000;

/** Fewer than this and a median is one or two matches — not a baseline. */
const MIN_MATCHES_FOR_MEDIAN = 3;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Returns null when there isn't enough of a session to have a baseline, and
 * callers treat null as "nothing is long" rather than "everything is".
 */
export function longMatchThresholdMs(durations: number[]): number | null {
  if (durations.length < MIN_MATCHES_FOR_MEDIAN) return null;
  const mid = median(durations);
  if (mid === null) return null;
  return Math.max(LONG_MATCH_FLOOR_MS, mid * LONG_MATCH_MULTIPLIER);
}

export interface SessionRecap {
  /** Completed only — voided matches are corrections, not history. */
  matchesPlayed: number;
  /** First start to last end. Null until at least one match has ended. */
  spanMs: number | null;
  /** Σ of every match's duration. Exceeds `spanMs` when courts ran in parallel. */
  totalCourtTimeMs: number;
  longest: { match: MatchRecord; durationMs: number } | null;
  upsetCount: number;
  durations: number[];
  longMatchThresholdMs: number | null;
}

/**
 * Describes whatever set of matches it is handed, which is always the set
 * currently on screen. A header that summarised the whole session while the
 * list showed a filtered subset would be quietly lying about what you're
 * looking at.
 */
export function computeSessionRecap(matches: MatchRecord[]): SessionRecap {
  const completed = matches.filter((m) => m.status === "COMPLETED" && m.result);

  const durations: number[] = [];
  let totalCourtTimeMs = 0;
  let longest: SessionRecap["longest"] = null;
  let upsetCount = 0;
  let earliestStart = Infinity;
  let latestEnd = -Infinity;

  for (const match of completed) {
    if (matchUpset(match)) upsetCount++;

    const started = new Date(match.startedAt).getTime();
    if (started < earliestStart) earliestStart = started;

    const durationMs = matchDurationMs(match);
    if (durationMs === null) continue;

    durations.push(durationMs);
    totalCourtTimeMs += durationMs;

    const ended = new Date(match.endedAt!).getTime();
    if (ended > latestEnd) latestEnd = ended;

    if (!longest || durationMs > longest.durationMs) longest = { match, durationMs };
  }

  return {
    matchesPlayed: completed.length,
    spanMs: latestEnd > earliestStart ? latestEnd - earliestStart : null,
    totalCourtTimeMs,
    longest,
    upsetCount,
    durations,
    longMatchThresholdMs: longMatchThresholdMs(durations),
  };
}

/** Which side a player was on, or null if they weren't in this match. */
export function playerSide(match: MatchRecord, playerId: string): "A" | "B" | null {
  if (match.sideA.some((p) => p.id === playerId)) return "A";
  if (match.sideB.some((p) => p.id === playerId)) return "B";
  return null;
}

export type PlayerOutcome = "win" | "loss" | "draw" | null;

/**
 * The result framed from one player's side.
 *
 * This is the thing the old "Wins" / "Losses" filters were missing. Without a
 * player to frame against they fell through to `result === "SIDE_A"` — and
 * since Side A is just whichever side happened to be written first, those two
 * pills split the same matches into two meaningless halves.
 */
export function outcomeForPlayer(match: MatchRecord, playerId: string): PlayerOutcome {
  if (match.status !== "COMPLETED" || !match.result) return null;
  const side = playerSide(match, playerId);
  if (!side) return null;
  if (match.result === "DRAW") return "draw";
  return (match.result === "SIDE_A") === (side === "A") ? "win" : "loss";
}

/**
 * The first player whose name contains the query, searched across both sides.
 *
 * Ordered A-then-B so the same player is picked every render for a stable
 * frame of reference; a query matching two people resolves to whoever appears
 * first rather than flickering between them.
 */
export function findSearchedPlayer(matches: MatchRecord[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const match of matches) {
    for (const player of [...match.sideA, ...match.sideB]) {
      if (player.name.toLowerCase().includes(q)) return player;
    }
  }
  return null;
}
