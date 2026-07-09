// Pure scoring engine for docs/specs/07-smart-matchup.md. Takes queue/match
// data as plain arguments (no fetching, no persistence) so it can run
// client-side today and move behind a server action later without changing
// this logic. Callers own state: which players are already claimed by
// earlier cards this round (excludedPlayerIds) and each player's running
// skip count (skipCounts) must be threaded back in on the next call.

import type { MatchRecord, MatchType, MatchupSuggestion, Player, QueueEntry, SkillLevel } from "@/types";

export interface SmartMatchupSettings {
  balanceWeight: number; // novelty weight = 1 - this
  windowSize: number;
  skipCapThreshold: number;
}

export const DEFAULT_SMART_MATCHUP_SETTINGS: SmartMatchupSettings = {
  balanceWeight: 0.6,
  windowSize: 8,
  skipCapThreshold: 2,
};

export interface SuggestMatchupInput {
  /** Full session queue, any order — sorted by arrival internally. */
  queue: QueueEntry[];
  /** This session's matches only (caller pre-filters by sessionId, same convention as leaderboard.ts). */
  matches: MatchRecord[];
  matchType: MatchType;
  /** Players already claimed by earlier cards in this same round. */
  excludedPlayerIds?: string[];
  /** playerId -> consecutive times skipped, session-scoped. */
  skipCounts?: Record<string, number>;
  settings?: Partial<SmartMatchupSettings>;
}

export interface SuggestMatchupResult {
  /** null when the window can't meet the match-type minimum. */
  suggestion: MatchupSuggestion | null;
  updatedSkipCounts: Record<string, number>;
}

export function suggestMatchup(input: SuggestMatchupInput): SuggestMatchupResult {
  const settings = { ...DEFAULT_SMART_MATCHUP_SETTINGS, ...input.settings };
  const skipCounts = input.skipCounts ?? {};
  const excluded = new Set(input.excludedPlayerIds ?? []);
  const groupSize = input.matchType === "DOUBLES" ? 4 : 2;

  // Un-picked players are never added to `excluded`, so they naturally stay
  // at the front of this list — the "rolling window" falls out for free.
  const window = input.queue
    .filter((entry) => !entry.isInMatch && !excluded.has(entry.player.id))
    .sort((a, b) => Date.parse(a.sessionJoinedAt) - Date.parse(b.sessionJoinedAt))
    .slice(0, settings.windowSize)
    .map((entry) => entry.player);

  if (window.length < groupSize) {
    return { suggestion: null, updatedSkipCounts: skipCounts };
  }

  const winRates = computeSessionWinRates(input.matches);
  const pairingCounts = buildPairingCounts(input.matches, input.matchType);
  const groups = combinations(window, groupSize);
  const tier = pickGenderTier(groups, input.matchType);

  const arrangements = buildArrangements(groups, input.matchType, tier).map((raw) =>
    scoreArrangement(raw, input.matchType, winRates, pairingCounts, settings.balanceWeight)
  );

  const forcedIds = window
    .filter((p) => (skipCounts[p.id] ?? 0) >= settings.skipCapThreshold)
    .sort((a, b) => (skipCounts[b.id] ?? 0) - (skipCounts[a.id] ?? 0))
    .slice(0, groupSize)
    .map((p) => p.id);

  const best = pickBest(arrangements, forcedIds);
  // Fresh (never-paired) arrangements score novelty === 1; if none exist,
  // every option available this round has been played before.
  const pairsExhausted = !arrangements.some((a) => a.novelty === 1);

  const chosenIds = new Set([...best.sideA, ...best.sideB].map((p) => p.id));
  const updatedSkipCounts = { ...skipCounts };
  for (const p of window) {
    updatedSkipCounts[p.id] = chosenIds.has(p.id) ? 0 : (skipCounts[p.id] ?? 0) + 1;
  }

  return {
    suggestion: { sideA: best.sideA, sideB: best.sideB, pairsExhausted },
    updatedSkipCounts,
  };
}

// ---------------------------------------------------------------------------
// Gender gate

type GenderTier = "SAME_GENDER" | "MIXED_DOUBLES" | "UNRESTRICTED";

function genderCounts(players: Player[]): { m: number; f: number } {
  let m = 0;
  let f = 0;
  for (const p of players) {
    if (p.gender === "M") m++;
    else if (p.gender === "F") f++;
  }
  return { m, f };
}

// Unset gender is a wildcard: only an actual M-vs-F conflict disqualifies.
function isSameGenderCompatible(players: Player[]): boolean {
  const { m, f } = genderCounts(players);
  return m === 0 || f === 0;
}

function isMixedDoublesFeasible(group: Player[]): boolean {
  const { m, f } = genderCounts(group);
  return m <= 2 && f <= 2;
}

// True mixed-doubles convention: each side gets at most one real M and one
// real F (wildcards fill whatever's left), not an arbitrary 2-and-2 split.
function isMixedDoublesSplit(sideA: Player[], sideB: Player[]): boolean {
  const a = genderCounts(sideA);
  const b = genderCounts(sideB);
  return a.m <= 1 && a.f <= 1 && b.m <= 1 && b.f <= 1;
}

function pickGenderTier(groups: Player[][], matchType: MatchType): GenderTier {
  if (groups.some(isSameGenderCompatible)) return "SAME_GENDER";
  if (matchType === "DOUBLES" && groups.some(isMixedDoublesFeasible)) return "MIXED_DOUBLES";
  return "UNRESTRICTED";
}

// ---------------------------------------------------------------------------
// Arrangement generation

interface RawArrangement {
  sideA: Player[];
  sideB: Player[];
}

function doublesSplits(group: Player[]): RawArrangement[] {
  const [a, b, c, d] = group;
  return [
    { sideA: [a, b], sideB: [c, d] },
    { sideA: [a, c], sideB: [b, d] },
    { sideA: [a, d], sideB: [b, c] },
  ];
}

function buildArrangements(groups: Player[][], matchType: MatchType, tier: GenderTier): RawArrangement[] {
  const arrangements: RawArrangement[] = [];

  for (const group of groups) {
    if (tier === "SAME_GENDER" && !isSameGenderCompatible(group)) continue;
    if (tier === "MIXED_DOUBLES" && !isMixedDoublesFeasible(group)) continue;

    if (matchType === "SINGLES") {
      arrangements.push({ sideA: [group[0]], sideB: [group[1]] });
      continue;
    }

    for (const split of doublesSplits(group)) {
      if (tier === "MIXED_DOUBLES" && !isMixedDoublesSplit(split.sideA, split.sideB)) continue;
      arrangements.push(split);
    }
  }

  return arrangements;
}

// ---------------------------------------------------------------------------
// Scoring

interface Arrangement extends RawArrangement {
  balance: number;
  novelty: number;
  challenge: number;
  final: number;
}

const SKILL_RANK: Record<SkillLevel, number> = { S: 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7 };

function normalizedSkill(level: SkillLevel): number {
  return (8 - SKILL_RANK[level]) / 7; // 1 = strongest (S), 0 = weakest (F)
}

function mean(nums: number[]): number {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function avgSkill(players: Player[]): number {
  return mean(players.map((p) => normalizedSkill(p.skillLevel)));
}

function sideStrength(players: Player[], winRates: Map<string, number>): number {
  const avgWinRate = mean(players.map((p) => winRates.get(p.id) ?? 0.5));
  return avgSkill(players) * 0.5 + avgWinRate * 0.5;
}

function balanceScore(sideA: Player[], sideB: Player[], winRates: Map<string, number>): number {
  // sideStrength is in [0,1], so the max possible gap between two sides is 1.
  const diff = Math.abs(sideStrength(sideA, winRates) - sideStrength(sideB, winRates));
  return 1 - diff;
}

// Rewards arrangements where players face an opponent at or above their own
// skill level, judged against the opposing side's average skill.
function challengeCount(sideA: Player[], sideB: Player[]): number {
  const strengthA = avgSkill(sideA);
  const strengthB = avgSkill(sideB);
  let count = 0;
  for (const p of sideA) if (strengthB >= normalizedSkill(p.skillLevel)) count++;
  for (const p of sideB) if (strengthA >= normalizedSkill(p.skillLevel)) count++;
  return count;
}

function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

// Scoped to the current match type: teammate history only means something in
// doubles, opponent history only in singles.
function buildPairingCounts(matches: MatchRecord[], matchType: MatchType): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (idA: string, idB: string) => {
    const key = pairKey(idA, idB);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (const match of matches) {
    if (match.status !== "COMPLETED" || match.matchType !== matchType) continue;
    if (matchType === "DOUBLES") {
      if (match.sideA.length === 2) bump(match.sideA[0].id, match.sideA[1].id);
      if (match.sideB.length === 2) bump(match.sideB[0].id, match.sideB[1].id);
    } else if (match.sideA.length === 1 && match.sideB.length === 1) {
      bump(match.sideA[0].id, match.sideB[0].id);
    }
  }

  return counts;
}

function noveltyScore(
  sideA: Player[],
  sideB: Player[],
  matchType: MatchType,
  pairingCounts: Map<string, number>
): number {
  const pairs: Array<[string, string]> =
    matchType === "DOUBLES"
      ? [
          [sideA[0].id, sideA[1].id],
          [sideB[0].id, sideB[1].id],
        ]
      : [[sideA[0].id, sideB[0].id]];

  const avgCount = mean(pairs.map(([a, b]) => pairingCounts.get(pairKey(a, b)) ?? 0));
  return avgCount === 0 ? 1 : 1 / (1 + avgCount);
}

// Draws count toward matchesPlayed but not wins, matching leaderboard.ts.
function computeSessionWinRates(matches: MatchRecord[]): Map<string, number> {
  const stats = new Map<string, { wins: number; played: number }>();
  const bump = (id: string, won: boolean) => {
    const s = stats.get(id) ?? { wins: 0, played: 0 };
    s.played++;
    if (won) s.wins++;
    stats.set(id, s);
  };

  for (const match of matches) {
    if (match.status !== "COMPLETED" || !match.result) continue;
    for (const p of match.sideA) bump(p.id, match.result === "SIDE_A");
    for (const p of match.sideB) bump(p.id, match.result === "SIDE_B");
  }

  const rates = new Map<string, number>();
  for (const [id, s] of Array.from(stats.entries())) rates.set(id, s.played > 0 ? s.wins / s.played : 0.5);
  return rates;
}

function scoreArrangement(
  raw: RawArrangement,
  matchType: MatchType,
  winRates: Map<string, number>,
  pairingCounts: Map<string, number>,
  balanceWeight: number
): Arrangement {
  const balance = balanceScore(raw.sideA, raw.sideB, winRates);
  const novelty = noveltyScore(raw.sideA, raw.sideB, matchType, pairingCounts);
  const challenge = challengeCount(raw.sideA, raw.sideB);
  const final = balanceWeight * balance + (1 - balanceWeight) * novelty;
  return { ...raw, balance, novelty, challenge, final };
}

// Near-equal finalScores are broken by Challenge, not by whichever arrangement
// happened to be enumerated first.
const CHALLENGE_TIEBREAK_EPSILON = 0.02;

function pickBest(arrangements: Arrangement[], forcedIdsByPriority: string[]): Arrangement {
  let candidates = arrangements;
  let forced = forcedIdsByPriority;

  // Force in as many skip-capped players as the window can actually seat,
  // dropping the lowest-priority one until a valid arrangement exists.
  while (forced.length > 0) {
    const restricted = candidates.filter((a) => {
      const ids = new Set([...a.sideA, ...a.sideB].map((p) => p.id));
      return forced.every((id) => ids.has(id));
    });
    if (restricted.length > 0) {
      candidates = restricted;
      break;
    }
    forced = forced.slice(0, -1);
  }

  const maxFinal = Math.max(...candidates.map((a) => a.final));
  const nearBest = candidates.filter((a) => maxFinal - a.final <= CHALLENGE_TIEBREAK_EPSILON);
  nearBest.sort((a, b) => b.challenge - a.challenge);
  return nearBest[0];
}

// ---------------------------------------------------------------------------
// Combinatorics

function combinations<T>(items: T[], k: number): T[][] {
  const results: T[][] = [];
  const combo: T[] = [];

  function backtrack(start: number) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }

  backtrack(0);
  return results;
}
