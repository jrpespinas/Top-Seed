import type { Gender, PaymentStatus, SkillLevel } from "@/types";
import { SKILL_LEVELS } from "./skill-level";

/**
 * The minimum a player needs to expose to be counted here.
 *
 * `name` is required because the rotation's laggards are surfaced by name —
 * an "N players behind" count that can't say who is a statistic, not an
 * action. Every caller already passes a full `Player`.
 */
export interface RosterPlayer {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  paymentStatus: PaymentStatus;
}

export interface SkillSlice {
  level: SkillLevel;
  count: number;
}

export interface GenderSlice {
  /** `null` for players added without one — real, and not the same as zero. */
  gender: Gender | null;
  count: number;
}

export interface PaymentTally {
  paid: number;
  waived: number;
  unpaid: number;
  /** Paid + waived: everyone the organiser no longer needs to chase. */
  settled: number;
}

export type RotationVerdict = "even" | "uneven" | "insufficient";

export interface RotationStats {
  /** One entry per games-played value from 0 to the busiest player. */
  buckets: { games: number; count: number }[];
  min: number;
  max: number;
  median: number;
  /** Players at least `LAGGARD_GAP` matches below the median. */
  laggards: RosterPlayer[];
  verdict: RotationVerdict;
}

export interface RosterStats {
  total: number;
  bySkill: SkillSlice[];
  byGender: GenderSlice[];
  payment: PaymentTally;
  rotation: RotationStats;
}

/**
 * How far below the median counts as "left out".
 *
 * Raw spread over-flags: someone who arrives an hour late will always trail,
 * and that isn't the rotation failing. Two matches below the middle of the
 * field is a gap wide enough to be worth walking over and checking, and it's a
 * sentence an organiser can act on — "played at least two fewer than most".
 */
export const LAGGARD_GAP = 2;

/** Below this the median isn't describing a field, it's describing noise. */
const MIN_PLAYERS_FOR_VERDICT = 4;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function tallySkill(players: RosterPlayer[]): SkillSlice[] {
  // Iterates the ladder rather than the players, so every tier appears in a
  // stable strongest-first order even at zero — a mix chart whose segments
  // reorder as people arrive is unreadable.
  return SKILL_LEVELS.map((level) => ({
    level,
    count: players.filter((p) => p.skillLevel === level).length,
  }));
}

function tallyGender(players: RosterPlayer[]): GenderSlice[] {
  const slices: GenderSlice[] = [
    { gender: "M", count: players.filter((p) => p.gender === "M").length },
    { gender: "F", count: players.filter((p) => p.gender === "F").length },
  ];
  const unknown = players.filter((p) => !p.gender).length;
  // Only shown when it exists. A permanent empty "unspecified" segment would
  // imply the roster is incomplete when it isn't.
  if (unknown > 0) slices.push({ gender: null, count: unknown });
  return slices;
}

function tallyPayment(players: RosterPlayer[]): PaymentTally {
  const paid = players.filter((p) => p.paymentStatus === "PAID").length;
  const waived = players.filter((p) => p.paymentStatus === "WAIVED").length;
  const unpaid = players.filter((p) => p.paymentStatus === "UNPAID").length;
  return { paid, waived, unpaid, settled: paid + waived };
}

/**
 * Did the queue actually share the court out?
 *
 * The whole rotation system exists to stop anyone being left sitting, and
 * nothing in the app has ever shown whether it worked. This is the one number
 * on the page with a person attached to it: go find whoever is on one match.
 */
function computeRotation(
  players: RosterPlayer[],
  gamesPlayed: Map<string, number>
): RotationStats {
  const counts = players.map((p) => gamesPlayed.get(p.id) ?? 0);
  if (counts.length === 0) {
    return { buckets: [], min: 0, max: 0, median: 0, laggards: [], verdict: "insufficient" };
  }

  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const mid = median(counts);

  const buckets = Array.from({ length: max + 1 }, (_, games) => ({
    games,
    count: counts.filter((c) => c === games).length,
  }));

  const laggards = players.filter((p) => (gamesPlayed.get(p.id) ?? 0) <= mid - LAGGARD_GAP);

  const verdict: RotationVerdict =
    players.length < MIN_PLAYERS_FOR_VERDICT
      ? "insufficient"
      : laggards.length > 0
      ? "uneven"
      : "even";

  return { buckets, min, max, median: mid, laggards, verdict };
}

export function computeRosterStats(
  players: RosterPlayer[],
  gamesPlayed: Map<string, number>
): RosterStats {
  return {
    total: players.length,
    bySkill: tallySkill(players),
    byGender: tallyGender(players),
    payment: tallyPayment(players),
    rotation: computeRotation(players, gamesPlayed),
  };
}

/** The rotation chart's own headline, so the reader isn't left to interpret bars. */
export function rotationSummary(rotation: RotationStats): string {
  if (rotation.verdict === "insufficient") return "Not enough players to judge";
  if (rotation.verdict === "even") {
    return rotation.min === rotation.max
      ? `Everyone played ${rotation.max}`
      : `Everyone played ${rotation.min}–${rotation.max}`;
  }
  const n = rotation.laggards.length;
  return `${n} player${n === 1 ? "" : "s"} well behind the rest`;
}


export interface WaitingPlayer {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  waitedMs: number;
}

export interface WaitBucket {
  fromMin: number;
  /** Null on the final, open-ended bucket. */
  toMin: number | null;
  count: number;
}

export type FlowVerdict = "flowing" | "backed-up" | "idle";

export interface WaitingStats {
  /** Everyone genuinely waiting, longest first. */
  waiting: WaitingPlayer[];
  /** Null when nobody is waiting — distinct from a wait of zero. */
  averageMs: number | null;
  longest: WaitingPlayer | null;
  buckets: WaitBucket[];
  /** A wait past this has missed a full rotation cycle. */
  longWaitMs: number;
  /** Everyone past that line. */
  stuck: WaitingPlayer[];
  verdict: FlowVerdict;
}

/**
 * Bucket edges in minutes, with an open-ended final bucket.
 *
 * Fixed rather than derived from the data. Adaptive buckets would rescale
 * every time someone joined or left the queue, and this chart updates every
 * second — axis labels that shuffle under the reader are unreadable. Fixed
 * edges also make two sessions comparable.
 */
const WAIT_BUCKET_EDGES = [0, 5, 10, 15, 20];

/** Used until the session has enough matches to know its own pace. */
export const DEFAULT_LONG_WAIT_MS = 15 * 60 * 1000;

/** The shape a live queue entry has to expose to be measured. */
export interface QueueWaitSource {
  player: { id: string; name: string; skillLevel: SkillLevel };
  isInMatch: boolean;
  enteredQueueAt: string;
}

/**
 * How long the queue has been making people wait, right now.
 *
 * Only computable for the **open** session, and only from the queue. Two
 * reasons, both structural rather than stylistic:
 *
 * - `enteredQueueAt` lives on `QueueEntry` alone. `BenchEntry` doesn't carry
 *   it and neither does `SessionPlayerSnapshot`, so a closed session has no
 *   waiting data preserved anywhere — it was never written down.
 * - Benched players opted out of the queue. Counting a bench sitter as
 *   "waiting" would inflate the average with people who aren't asking for a
 *   game, and would point the longest-wait callout at someone who doesn't
 *   want to be called.
 *
 * Players currently on court are excluded for the same reason: their
 * `enteredQueueAt` is a stale timestamp from before they were pulled, so
 * counting them would report a wait that already ended.
 */
function bucketWaits(waiting: WaitingPlayer[]): WaitBucket[] {
  return WAIT_BUCKET_EDGES.map((fromMin, i) => {
    const toMin = i === WAIT_BUCKET_EDGES.length - 1 ? null : WAIT_BUCKET_EDGES[i + 1];
    const from = fromMin * 60_000;
    const to = toMin === null ? Infinity : toMin * 60_000;
    return {
      fromMin,
      toMin,
      count: waiting.filter((w) => w.waitedMs >= from && w.waitedMs < to).length,
    };
  });
}

/**
 * @param medianMatchMs How long a match typically runs this session, or null
 *   before enough have finished to tell. A wait longer than one match means
 *   the player sat through a full rotation cycle without being picked, which
 *   is the point at which the queue is draining slower than it fills. A fixed
 *   constant can't say that: twelve minutes is fine where matches run 25 and
 *   bad where they run 8.
 */
export function computeWaitingStats(
  entries: QueueWaitSource[],
  now: number,
  medianMatchMs: number | null = null
): WaitingStats {
  const waiting = entries
    .filter((e) => !e.isInMatch)
    .map((e) => ({
      id: e.player.id,
      name: e.player.name,
      skillLevel: e.player.skillLevel,
      // Clamped: a clock adjustment between writing the timestamp and reading
      // it can otherwise produce a negative wait, which reads as a bug.
      waitedMs: Math.max(0, now - new Date(e.enteredQueueAt).getTime()),
    }))
    .filter((w) => Number.isFinite(w.waitedMs))
    .sort((a, b) => b.waitedMs - a.waitedMs);

  const longWaitMs = medianMatchMs && medianMatchMs > 0 ? medianMatchMs : DEFAULT_LONG_WAIT_MS;

  if (waiting.length === 0) {
    return {
      waiting,
      averageMs: null,
      longest: null,
      buckets: bucketWaits(waiting),
      longWaitMs,
      stuck: [],
      verdict: "idle",
    };
  }

  const total = waiting.reduce((sum, w) => sum + w.waitedMs, 0);
  const stuck = waiting.filter((w) => w.waitedMs >= longWaitMs);

  return {
    waiting,
    averageMs: Math.round(total / waiting.length),
    longest: waiting[0],
    buckets: bucketWaits(waiting),
    longWaitMs,
    stuck,
    verdict: stuck.length > 0 ? "backed-up" : "flowing",
  };
}

/** The wait chart's own headline, so bars aren't left to be interpreted. */
export function flowSummary(stats: WaitingStats): string {
  if (stats.verdict === "idle") return "Nobody in the queue";
  if (stats.verdict === "flowing") {
    const longestMin = Math.floor((stats.longest?.waitedMs ?? 0) / 60_000);
    return longestMin < 1 ? "Everyone just sat down" : `Everyone under ${longestMin + 1}m`;
  }
  const n = stats.stuck.length;
  return `${n} waiting longer than a match`;
}
