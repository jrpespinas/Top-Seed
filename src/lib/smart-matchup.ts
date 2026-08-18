// Pure scoring engine for docs/specs/07-smart-matchup.md. Takes queue/match
// data as plain arguments (no fetching, no persistence) so it can run
// client-side today and move behind a server action later without changing
// this logic. Callers own state: which players are already claimed by
// earlier cards this round (excludedPlayerIds) and each player's running
// skip count (skipCounts) must be threaded back in on the next call.

import type { MatchRecord, MatchType, MatchupSuggestion, Player, QueueEntry, SkillLevel } from "@/types";
import { SKILL_LEVELS, SKILL_RANK, isAdjacentLevel } from "./skill-level";

export interface SmartMatchupSettings {
  balanceWeight: number; // novelty weight = 1 - this
  /** Floor of the Unrestricted-tier window — also today's flat size for any session with <20 waiting. */
  windowSize: number;
  /** Ceiling both the Unrestricted window and any single level-tier pool scale up to. A defensive/fairness cap, not a performance one. */
  maxWindowSize: number;
  skipCapThreshold: number;
}

export const DEFAULT_SMART_MATCHUP_SETTINGS: SmartMatchupSettings = {
  balanceWeight: 0.6,
  windowSize: 10,
  maxWindowSize: 24,
  skipCapThreshold: 2,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Governs only the Unrestricted tier's window today (see resolveFreshTier) —
// the true last resort once level has been fully given up on for this
// round. Small sessions are unaffected (the floor is today's constant); the
// ceiling is a deliberate fairness cap, not a performance one.
function effectiveWindowSize(waitingCount: number, settings: SmartMatchupSettings): number {
  return clamp(Math.floor(waitingCount / 2), settings.windowSize, settings.maxWindowSize);
}

// A card's current, possibly-partial placement — same shape as
// MatchupSuggestion. Passing this in locks every non-null slot to its
// current player and searches only for the remaining open slots, instead of
// generating a fresh full group. Used by Resuggest on a `proposed` card and
// by the bulk Suggest-All sweep.
export interface LockedPlacement {
  sideA: (Player | null)[];
  sideB: (Player | null)[];
}

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
  /** playerId -> games played this session; 0/missing forces a first-game include. */
  gamesPlayedMap?: Map<string, number>;
  /** Present only when filling the open slots of an already-partial card. */
  lockedPlacement?: LockedPlacement;
  /** SkillLevel -> consecutive successful suggestions since that band was last served, session-scoped. Fresh full-group generation only — see resolveFreshTier. */
  roundsSinceServed?: Partial<Record<SkillLevel, number>>;
  settings?: Partial<SmartMatchupSettings>;
}

export interface SuggestMatchupResult {
  /** null when there aren't enough eligible players at all (or to fill the remaining open slots for a locked placement). */
  suggestion: MatchupSuggestion | null;
  updatedSkipCounts: Record<string, number>;
  updatedRoundsSinceServed: Partial<Record<SkillLevel, number>>;
}

export function suggestMatchup(input: SuggestMatchupInput): SuggestMatchupResult {
  const settings = { ...DEFAULT_SMART_MATCHUP_SETTINGS, ...input.settings };
  const skipCounts = input.skipCounts ?? {};
  const roundsSinceServed = input.roundsSinceServed ?? {};
  const excluded = new Set(input.excludedPlayerIds ?? []);
  const groupSize = input.matchType === "DOUBLES" ? 4 : 2;

  const lockedPlacement = input.lockedPlacement;
  const lockedPlayers = lockedPlacement ? extractLockedPlayers(lockedPlacement) : [];
  const lockedIds = new Set(lockedPlayers.map((p) => p.id));
  const numToPick = groupSize - lockedPlayers.length;

  if (numToPick <= 0) {
    return { suggestion: null, updatedSkipCounts: skipCounts, updatedRoundsSinceServed: roundsSinceServed };
  }

  // Every not-mid-match, not-yet-claimed-this-round entry — the full pool
  // this call can draw from, before any per-tier pool/window slicing.
  const eligible = input.queue.filter(
    (entry) => !entry.isInMatch && !excluded.has(entry.player.id) && !lockedIds.has(entry.player.id)
  );

  if (eligible.length < numToPick) {
    return { suggestion: null, updatedSkipCounts: skipCounts, updatedRoundsSinceServed: roundsSinceServed };
  }

  // Session-wide waiting count (not scoped to this card's own exclusions) —
  // drives the Unrestricted tier's window scaling only. "How much variety
  // exists in the room right now" doesn't shrink just because earlier cards
  // this round already claimed a few players.
  const waitingCount = input.queue.filter((entry) => !entry.isInMatch).length;

  const winRates = computeSessionWinRates(input.matches);
  const pairingCounts = buildPairingCounts(input.matches, input.matchType);
  const bandRoster = buildLevelRoster(input.queue, input.matches);
  const partnerSets = buildPartnerSets(input.matches, input.matchType);

  let candidatePool: Player[];
  let arrangements: Arrangement[];
  // Only ever set on the fresh-generation path — lock-and-fill stays out of
  // scope for band scheduling, same boundary as win/loss-directed escalation.
  let anchorLevel: SkillLevel | null = null;

  if (lockedPlacement && lockedPlayers.length > 0) {
    const pool = sortByArrival(eligible)
      .slice(0, effectiveWindowSize(waitingCount, settings))
      .map((entry) => entry.player);
    const resolved = resolveLockedTier(
      pool,
      lockedPlacement,
      lockedPlayers,
      numToPick,
      input.matchType,
      winRates,
      pairingCounts,
      partnerSets,
      bandRoster,
      settings.balanceWeight
    );
    candidatePool = pool;
    arrangements = resolved.arrangements;
  } else {
    const resolved = resolveFreshTier(
      eligible,
      waitingCount,
      groupSize,
      input.matchType,
      winRates,
      pairingCounts,
      partnerSets,
      bandRoster,
      input.gamesPlayedMap,
      roundsSinceServed,
      settings
    );
    candidatePool = resolved.pool;
    arrangements = resolved.arrangements;
    anchorLevel = resolved.anchorLevel;
  }

  if (arrangements.length === 0) {
    return { suggestion: null, updatedSkipCounts: skipCounts, updatedRoundsSinceServed: roundsSinceServed };
  }

  // Zero-games players get fast-tracked into their first game ahead of
  // skip-capped ones — deliberately not persisted past that first game, so
  // early arrivals still naturally accumulate more total games from having
  // more session time, with no separate fairness penalty needed.
  const zeroGamesIds = candidatePool
    .filter((p) => (input.gamesPlayedMap?.get(p.id) ?? 0) === 0)
    .map((p) => p.id);
  const skipCappedIds = candidatePool
    .filter((p) => (skipCounts[p.id] ?? 0) >= settings.skipCapThreshold)
    .sort((a, b) => (skipCounts[b.id] ?? 0) - (skipCounts[a.id] ?? 0))
    .map((p) => p.id);
  // Third force-include category, lowest priority of the three — a player
  // who's explored less than half their own band gets a push toward being
  // seated, same list zero-games/skip-capped players already join. Fresh
  // generation only (anchorLevel is null on the locked path), matching
  // band scheduling's existing scope boundary.
  const underCoveredIds = anchorLevel
    ? candidatePool
        .filter((p) => coverageRatio(p.id, p.skillLevel, partnerSets, bandRoster) < UNDER_COVERED_THRESHOLD)
        .sort(
          (a, b) =>
            coverageRatio(a.id, a.skillLevel, partnerSets, bandRoster) -
            coverageRatio(b.id, b.skillLevel, partnerSets, bandRoster)
        )
        .map((p) => p.id)
    : [];
  const forcedIds = Array.from(new Set([...zeroGamesIds, ...skipCappedIds, ...underCoveredIds])).slice(0, numToPick);

  const best = pickBest(arrangements, forcedIds);
  // Fresh (never-paired) arrangements score novelty === 1. Exact/Adjacent
  // are only ever chosen when a fresh arrangement already exists (see
  // resolveFreshTier / resolveLockedTier below), so seeing this true here
  // really means the search fell all the way to Unrestricted and even that
  // was exhausted — drives the existing "least recently repeated" UI note.
  const pairsExhausted = !arrangements.some((a) => a.novelty === 1);

  const chosenIds = new Set([...best.sideA, ...best.sideB].map((p) => p.id));
  const updatedSkipCounts = { ...skipCounts };
  for (const p of candidatePool) {
    updatedSkipCounts[p.id] = chosenIds.has(p.id) ? 0 : (skipCounts[p.id] ?? 0) + 1;
  }

  // Reset the band that actually anchored this search, bump every other
  // band — a full 4-key record every time, so a band that's never been
  // touched yet still reads as 0 rather than undefined. Lock-and-fill
  // (anchorLevel null) leaves this untouched, matching its exclusion from
  // the win/loss-directed escalation above.
  const updatedRoundsSinceServed = anchorLevel
    ? SKILL_LEVELS.reduce<Partial<Record<SkillLevel, number>>>((acc, cluster) => {
        acc[cluster] = cluster === anchorLevel ? 0 : (roundsSinceServed[cluster] ?? 0) + 1;
        return acc;
      }, {} as Partial<Record<SkillLevel, number>>)
    : roundsSinceServed;

  return {
    suggestion: { sideA: best.sideA, sideB: best.sideB, pairsExhausted },
    updatedSkipCounts,
    updatedRoundsSinceServed,
  };
}

function sortByArrival(entries: QueueEntry[]): QueueEntry[] {
  return entries.slice().sort((a, b) => Date.parse(a.sessionJoinedAt) - Date.parse(b.sessionJoinedAt));
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
// Level gate — outer gate wrapping the gender gate above. Mixed-gender play
// is a last resort tried only within a level tier that's already been
// settled on, never traded off against it: "as much as possible, all
// players the same level" ranks above gender matching entirely.

type LevelTier = "EXACT_LEVEL" | "ADJACENT_LEVEL" | "UNRESTRICTED";



function levelSpread(players: Player[]): number {
  const ranks = players.map((p) => SKILL_RANK[p.skillLevel]);
  return Math.max(...ranks) - Math.min(...ranks);
}

function isExactLevelCompatible(players: Player[]): boolean {
  return levelSpread(players) === 0;
}

// The band layer is gone. It existed because the old seven-tier ladder was
// too fine for exact-level matching to ever succeed, so levels had to be
// grouped into interchangeable clusters. At four tiers each level is already
// about as wide as a band was, so "same band" and "same level" collapsed into
// the same thing and the four-step escalation ladder became three:
// exact level -> adjacent level -> unrestricted.
//
// SkillLevel is now just SkillLevel: anti-starvation and partner coverage are
// keyed on level directly.

// "UP" = toward stronger (lower SKILL_RANK number). "DOWN" = toward weaker.
type Direction = "UP" | "DOWN";

// Adjacent = at most one rung apart, and symmetric: if an Intermediate short
// of peers may play down to a Beginner, that pairing has to be reachable when
// the Beginner is the one waiting. Which way a player actually reaches is
// decided by their own win rate (escalationDirection below), not by the gate.
function isAdjacentLevelCompatible(players: Player[]): boolean {
  return players.every((p) => isAdjacentLevel(p.skillLevel, players[0].skillLevel));
}

function neighborLevel(level: SkillLevel, direction: Direction): SkillLevel | null {
  const index = SKILL_LEVELS.indexOf(level);
  // SKILL_LEVELS runs strongest-first, so "UP" is one step toward index 0.
  return SKILL_LEVELS[direction === "UP" ? index - 1 : index + 1] ?? null;
}

const DIRECTIONAL_WIN_RATE_HIGH = 0.65;
const DIRECTIONAL_WIN_RATE_LOW = 0.35;
const DIRECTIONAL_MIN_GAMES = 3;

// Anti-starvation backstop for level scheduling (see pickAnchorEntry below):
// longest-wait stays the default rule, but a level that's gone unserved for
// this many consecutive successful suggestions — while it actually has players
// waiting — gets forced to the front regardless of who's technically waited
// longer elsewhere. Thin levels otherwise keep losing out to larger ones purely
// on individual wait-time odds.
const LEVEL_STARVATION_THRESHOLD = 3;

// A player's own session record redirects which adjacent level gets tried once
// their own level's freshness is exhausted — winning a lot points the search
// up, losing a lot points it down. Returns null (no signal) below the
// games-played floor or inside the neutral band: a 1-0 record is too small a
// sample to act on, and a genuinely even player shouldn't get pulled off their
// level at all.
function escalationDirection(
  playerId: string,
  winRates: Map<string, number>,
  gamesPlayedMap: Map<string, number> | undefined
): Direction | null {
  const games = gamesPlayedMap?.get(playerId) ?? 0;
  if (games < DIRECTIONAL_MIN_GAMES) return null;
  const rate = winRates.get(playerId) ?? 0.5;
  if (rate >= DIRECTIONAL_WIN_RATE_HIGH) return "UP";
  if (rate <= DIRECTIONAL_WIN_RATE_LOW) return "DOWN";
  return null;
}

// Same level, or the one neighbour the player's record points toward.
function isLevelOrDirectionalNeighbor(level: SkillLevel, targetLevel: SkillLevel, direction: Direction): boolean {
  if (level === targetLevel) return true;
  return level === neighborLevel(targetLevel, direction);
}

// Neutral-signal counterpart: same level or either neighbour, since there's no
// preferred direction to choose between them.
function isSameOrEitherNeighborLevel(level: SkillLevel, targetLevel: SkillLevel): boolean {
  return isAdjacentLevel(level, targetLevel);
}

function levelTierMatches(tier: LevelTier, group: Player[]): boolean {
  if (tier === "EXACT_LEVEL") return isExactLevelCompatible(group);
  if (tier === "ADJACENT_LEVEL") return isAdjacentLevelCompatible(group);
  return true;
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

function extractLockedPlayers(placement: LockedPlacement): Player[] {
  return [...placement.sideA, ...placement.sideB].filter((p): p is Player => p !== null);
}

// Fills each open (null) slot in array order from `newPlayers`, in the order
// given — which specific open slot a given new player lands in never affects
// scoring (only which side it's on does), so no need to try every ordering.
function fillSide(locked: (Player | null)[], newPlayers: Player[]): Player[] {
  const queue = [...newPlayers];
  return locked.map((slot) => slot ?? queue.shift()!);
}

// Locked-slot counterpart to buildArrangements: for each combo of new
// players, tries every way to split them across the open slots on each side
// (a plain choose-k-for-side-A, not a full permutation — index position
// within a side never affects scoring) and keeps the ones that satisfy the
// already-chosen level/gender tiers.
function buildArrangementsLocked(
  lockedPlacement: LockedPlacement,
  newCombos: Player[][],
  levelTier: LevelTier,
  genderTier: GenderTier
): RawArrangement[] {
  const lockedSideA = lockedPlacement.sideA;
  const lockedSideB = lockedPlacement.sideB;
  const openACount = lockedSideA.filter((v) => v === null).length;
  const lockedPlayers = extractLockedPlayers(lockedPlacement);

  const arrangements: RawArrangement[] = [];

  for (const combo of newCombos) {
    const fullGroup = [...lockedPlayers, ...combo];
    if (!levelTierMatches(levelTier, fullGroup)) continue;
    if (genderTier === "SAME_GENDER" && !isSameGenderCompatible(fullGroup)) continue;
    if (genderTier === "MIXED_DOUBLES" && !isMixedDoublesFeasible(fullGroup)) continue;

    for (const sideANew of combinations(combo, openACount)) {
      const sideANewIds = new Set(sideANew.map((p) => p.id));
      const sideBNew = combo.filter((p) => !sideANewIds.has(p.id));

      const sideA = fillSide(lockedSideA, sideANew);
      const sideB = fillSide(lockedSideB, sideBNew);

      if (genderTier === "MIXED_DOUBLES" && !isMixedDoublesSplit(sideA, sideB)) continue;
      arrangements.push({ sideA, sideB });
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
  winRateBalance: number;
  /** Inverse of coverageRatio — higher means these players have collectively explored LESS of their band. See pickBest. */
  coverage: number;
  final: number;
}

function normalizedSkill(level: SkillLevel): number {
  return (8 - SKILL_RANK[level]) / 7; // 1 = strongest (S), 0 = weakest (F)
}

function mean(nums: number[]): number {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function avgSkill(players: Player[]): number {
  return mean(players.map((p) => normalizedSkill(p.skillLevel)));
}

// Skill-only: the level gate above already keeps groups at the same or
// adjacent tier whenever the queue allows it, so balance's job is just to
// even out the two sides within whatever group got picked. Win rate is
// still considered — as a tiebreak only, see winRateBalanceScore below.
function balanceScore(sideA: Player[], sideB: Player[]): number {
  const diff = Math.abs(avgSkill(sideA) - avgSkill(sideB));
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

// Third-stage tiebreak only (see pickBest) — how even the two sides' session
// win rates are, now that skill balance no longer folds it in directly.
function winRateBalanceScore(sideA: Player[], sideB: Player[], winRates: Map<string, number>): number {
  const avgA = mean(sideA.map((p) => winRates.get(p.id) ?? 0.5));
  const avgB = mean(sideB.map((p) => winRates.get(p.id) ?? 0.5));
  return 1 - Math.abs(avgA - avgB);
}

// Every distinct player who's ever appeared in a given band this session —
// currently waiting, mid-match, or done for the day. Deliberately wider than
// "who's in the pool right now": a player shouldn't read as "fully covered"
// just because they've played everyone who happened to be waiting alongside
// them, when other bandmates they've never faced simply tend to be mid-match
// whenever they come up. Selection still only ever draws from who's
// currently eligible — this is only used to measure how much of the band a
// player has genuinely explored, see coverageRatio below.
function buildLevelRoster(queue: QueueEntry[], matches: MatchRecord[]): Map<SkillLevel, Set<string>> {
  const roster = new Map<SkillLevel, Set<string>>();
  const add = (playerId: string, level: SkillLevel) => {
    if (!roster.has(level)) roster.set(level, new Set());
    roster.get(level)!.add(playerId);
  };

  for (const entry of queue) add(entry.player.id, entry.player.skillLevel);
  for (const match of matches) {
    for (const p of [...match.sideA, ...match.sideB]) add(p.id, p.skillLevel);
  }

  return roster;
}

// The same "pair" relationship pairingCounts already tracks (teammates in
// doubles, opponents in singles) — as membership per player rather than
// counts per pair, for measuring how much of their own band each player has
// explored (coverageRatio below), not just whether one specific pair repeats.
function buildPartnerSets(matches: MatchRecord[], matchType: MatchType): Map<string, Set<string>> {
  const partners = new Map<string, Set<string>>();
  const link = (idA: string, idB: string) => {
    if (!partners.has(idA)) partners.set(idA, new Set());
    if (!partners.has(idB)) partners.set(idB, new Set());
    partners.get(idA)!.add(idB);
    partners.get(idB)!.add(idA);
  };

  for (const match of matches) {
    if (match.status !== "COMPLETED" || match.matchType !== matchType) continue;
    if (matchType === "DOUBLES") {
      if (match.sideA.length === 2) link(match.sideA[0].id, match.sideA[1].id);
      if (match.sideB.length === 2) link(match.sideB[0].id, match.sideB[1].id);
    } else if (match.sideA.length === 1 && match.sideB.length === 1) {
      link(match.sideA[0].id, match.sideB[0].id);
    }
  }

  return partners;
}

// Fraction of a player's own band they've already played with (or against,
// singles), 0-1. A band of 1 (nobody else has ever appeared there this
// session) reads as fully covered — there's nothing left to explore, not a
// deficiency.
function coverageRatio(
  playerId: string,
  cluster: SkillLevel,
  partnerSets: Map<string, Set<string>>,
  bandRoster: Map<SkillLevel, Set<string>>
): number {
  const roster = bandRoster.get(cluster);
  const rosterSize = roster?.size ?? 0;
  if (rosterSize <= 1) return 1;

  const partners = partnerSets.get(playerId);
  if (!partners) return 0;

  let covered = 0;
  for (const otherId of Array.from(partners)) {
    if (otherId !== playerId && roster!.has(otherId)) covered++;
  }
  return covered / (rosterSize - 1);
}

// Fourth scoring dimension (see pickBest) — deliberately the INVERSE of
// coverageRatio (higher = LESS explored), to match every other score here
// where higher is always better: an arrangement of players who've each
// covered little of their band scores high, rewarding spread instead of
// letting balance-score ties repeatedly favor the same closely-matched
// clique within an already-fresh candidate set.
function coverageScore(
  sideA: Player[],
  sideB: Player[],
  partnerSets: Map<string, Set<string>>,
  bandRoster: Map<SkillLevel, Set<string>>
): number {
  const all = [...sideA, ...sideB];
  const ratios = all.map((p) => coverageRatio(p.id, p.skillLevel, partnerSets, bandRoster));
  return 1 - mean(ratios);
}

function scoreArrangement(
  raw: RawArrangement,
  matchType: MatchType,
  winRates: Map<string, number>,
  pairingCounts: Map<string, number>,
  partnerSets: Map<string, Set<string>>,
  bandRoster: Map<SkillLevel, Set<string>>,
  balanceWeight: number
): Arrangement {
  const balance = balanceScore(raw.sideA, raw.sideB);
  const novelty = noveltyScore(raw.sideA, raw.sideB, matchType, pairingCounts);
  const challenge = challengeCount(raw.sideA, raw.sideB);
  const winRateBalance = winRateBalanceScore(raw.sideA, raw.sideB, winRates);
  const coverage = coverageScore(raw.sideA, raw.sideB, partnerSets, bandRoster);
  const final = balanceWeight * balance + (1 - balanceWeight) * novelty;
  return { ...raw, balance, novelty, challenge, winRateBalance, coverage, final };
}

// Near-equal finalScores are broken by Coverage, then Challenge, then by
// win-rate balance — not by whichever arrangement happened to be enumerated
// first. Coverage sits first among the tiebreaks (ahead of the two existing
// secondary refinements) specifically because it's the direct answer to
// "spread exposure more" — outranking challenge/win-rate here is deliberate.
const CHALLENGE_TIEBREAK_EPSILON = 0.02;
const COVERAGE_TIEBREAK_EPSILON = 0.02;

// Force-include threshold — how under-explored (relative to their own band)
// a player needs to be before joining the zero-games/skip-cap priority list
// in suggestMatchup. 50%: meaningfully behind, not just "hasn't literally
// played everyone yet."
const UNDER_COVERED_THRESHOLD = 0.5;

function pickBest(arrangements: Arrangement[], forcedIdsByPriority: string[]): Arrangement {
  let candidates = arrangements;
  let forced = forcedIdsByPriority;

  // Force in as many zero-games/skip-capped/under-covered players as the
  // window can actually seat, dropping the lowest-priority one until a
  // valid arrangement exists.
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

  const maxCoverage = Math.max(...nearBest.map((a) => a.coverage));
  const nearBestCoverage = nearBest.filter((a) => maxCoverage - a.coverage <= COVERAGE_TIEBREAK_EPSILON);

  const maxChallenge = Math.max(...nearBestCoverage.map((a) => a.challenge));
  const nearBestChallenge = nearBestCoverage.filter((a) => a.challenge === maxChallenge);

  nearBestChallenge.sort((a, b) => b.winRateBalance - a.winRateBalance);
  return nearBestChallenge[0];
}

// ---------------------------------------------------------------------------
// Tier resolution — turns a candidate pool into a level tier + scored
// arrangements. Two flavors: resolveFreshTier (full-group generation, one
// dedicated pool per skill level) and resolveLockedTier (filling the open
// slots of an already-partial card, one shared general pool re-filtered per
// tier — the locked players already pin down most of the level context, so
// a per-level pool doesn't add much there).

interface TierResolution {
  levelTier: LevelTier;
  pool: Player[];
  arrangements: Arrangement[];
  /** Which band actually drove this search, win/loss escalation included — null only if eligible was empty. */
  anchorLevel: SkillLevel | null;
}

function hasFreshArrangement(arrangements: Arrangement[]): boolean {
  return arrangements.some((a) => a.novelty === 1);
}

// The single oldest eligible player's own level IS, by construction, the
// level whose oldest member is earliest among every level's oldest member —
// no need to compute per-level minimums and compare them. Returns the whole
// entry (not just the level) so the caller can also read this player's own
// id for the win-rate-directed escalation below.
function mostOverdueEntry(eligible: QueueEntry[]): QueueEntry | null {
  if (eligible.length === 0) return null;
  let oldest = eligible[0];
  for (const entry of eligible) {
    if (Date.parse(entry.sessionJoinedAt) < Date.parse(oldest.sessionJoinedAt)) oldest = entry;
  }
  return oldest;
}

// Decides which player's wait anchors this round's search — normally the
// single longest-waiting eligible player (mostOverdueEntry, unchanged), but
// a band that's crossed LEVEL_STARVATION_THRESHOLD without a turn (and has
// someone actually waiting) overrides that and gets served instead. Multiple
// starved bands at once: the most-starved one wins, tie-broken by its own
// longest-waiting member — so even the override still leans on wait time
// wherever it can.
function pickAnchorEntry(eligible: QueueEntry[], roundsSinceServed: Partial<Record<SkillLevel, number>>): QueueEntry | null {
  if (eligible.length === 0) return null;

  const oldestByCluster = new Map<SkillLevel, QueueEntry>();
  for (const entry of eligible) {
    const cluster = entry.player.skillLevel;
    const current = oldestByCluster.get(cluster);
    if (!current || Date.parse(entry.sessionJoinedAt) < Date.parse(current.sessionJoinedAt)) {
      oldestByCluster.set(cluster, entry);
    }
  }

  const starved = Array.from(oldestByCluster.entries())
    .filter(([cluster]) => (roundsSinceServed[cluster] ?? 0) >= LEVEL_STARVATION_THRESHOLD)
    .sort((a, b) => {
      const roundsDiff = (roundsSinceServed[b[0]] ?? 0) - (roundsSinceServed[a[0]] ?? 0);
      if (roundsDiff !== 0) return roundsDiff;
      return Date.parse(a[1].sessionJoinedAt) - Date.parse(b[1].sessionJoinedAt);
    });

  if (starved.length > 0) return starved[0][1];

  return mostOverdueEntry(eligible);
}

function poolForLevel(eligible: QueueEntry[], predicate: (entry: QueueEntry) => boolean, cap: number): Player[] {
  return sortByArrival(eligible.filter(predicate))
    .slice(0, cap)
    .map((entry) => entry.player);
}

function attemptLevelTier(
  pool: Player[],
  tier: LevelTier,
  groupSize: number,
  matchType: MatchType,
  winRates: Map<string, number>,
  pairingCounts: Map<string, number>,
  partnerSets: Map<string, Set<string>>,
  bandRoster: Map<SkillLevel, Set<string>>,
  balanceWeight: number
): Arrangement[] | null {
  if (pool.length < groupSize) return null;

  const groups = combinations(pool, groupSize).filter((g) => levelTierMatches(tier, g));
  if (groups.length === 0) return null;

  const genderTier = pickGenderTier(groups, matchType);
  const raw = buildArrangements(groups, matchType, genderTier);
  if (raw.length === 0) return null;

  return raw.map((r) => scoreArrangement(r, matchType, winRates, pairingCounts, partnerSets, bandRoster, balanceWeight));
}

// A single skill level is naturally a small slice of a big session, so it
// doesn't need the shared window's fairness cap the way a mixed pool does —
// every waiting player at that level (up to maxWindowSize, a defensive
// ceiling only) is visible, always. Escalates by FRESHNESS, not just
// existence: a level whose players have already played every combination of
// each other doesn't win just because a same-level group technically
// exists — that's what let a small Advanced pool get stuck replaying itself
// every round. Only the single most-overdue level is tried before falling
// through to Unrestricted; it doesn't hunt across every other level first.
function resolveFreshTier(
  eligible: QueueEntry[],
  waitingCount: number,
  groupSize: number,
  matchType: MatchType,
  winRates: Map<string, number>,
  pairingCounts: Map<string, number>,
  partnerSets: Map<string, Set<string>>,
  bandRoster: Map<SkillLevel, Set<string>>,
  gamesPlayedMap: Map<string, number> | undefined,
  roundsSinceServed: Partial<Record<SkillLevel, number>>,
  settings: SmartMatchupSettings
): TierResolution {
  const targetEntry = pickAnchorEntry(eligible, roundsSinceServed);
  const anchorLevel = targetEntry ? targetEntry.player.skillLevel : null;

  if (targetEntry) {
    const targetLevel = targetEntry.player.skillLevel;

    const exactPool = poolForLevel(eligible, (e) => e.player.skillLevel === targetLevel, settings.maxWindowSize);
    const exactAttempt = attemptLevelTier(
      exactPool,
      "EXACT_LEVEL",
      groupSize,
      matchType,
      winRates,
      pairingCounts,
      partnerSets,
      bandRoster,
      settings.balanceWeight
    );
    if (exactAttempt && hasFreshArrangement(exactAttempt)) {
      return { levelTier: "EXACT_LEVEL", pool: exactPool, arrangements: exactAttempt, anchorLevel };
    }

    // Step 2: same band, whatever's in it — tried for EVERY player, signal
    // or not, before any cross-band reach is considered. Trivially a no-op
    // for standalone bands (Intermediate, Pro), whose "whole band" pool is
    // identical to the already-exhausted exact pool — they fall straight
    // through to step 3 below, which is exactly where they need to be.
    const sameBandPool = poolForLevel(
      eligible,
      (e) => ((a: SkillLevel, b: SkillLevel) => a === b)(e.player.skillLevel, targetLevel),
      settings.maxWindowSize
    );
    const sameBandAttempt = attemptLevelTier(
      sameBandPool,
      "ADJACENT_LEVEL",
      groupSize,
      matchType,
      winRates,
      pairingCounts,
      partnerSets,
      bandRoster,
      settings.balanceWeight
    );
    if (sameBandAttempt && hasFreshArrangement(sameBandAttempt)) {
      return { levelTier: "ADJACENT_LEVEL", pool: sameBandPool, arrangements: sameBandAttempt, anchorLevel };
    }

    // Step 3: same band is also exhausted (or, for a standalone band, was
    // never wider than exact to begin with) — cross into a neighboring
    // band. The direction this session-record points, not a blind
    // either-way search, gets tried first.
    const direction = escalationDirection(targetEntry.player.id, winRates, gamesPlayedMap);

    if (direction === null) {
      // No reliable signal (too few games, or a genuinely even record) —
      // both neighboring bands combined, one attempt. (The pool includes
      // same-band candidates too, but that's harmless: a same-band-only
      // group would already have been caught as fresh in step 2 above, so
      // only genuinely cross-band groups can still be fresh here.)
      const bothNeighborsPool = poolForLevel(
        eligible,
        (e) => isSameOrEitherNeighborLevel(e.player.skillLevel, targetLevel),
        settings.maxWindowSize
      );
      const bothNeighborsAttempt = attemptLevelTier(
        bothNeighborsPool,
        "ADJACENT_LEVEL",
        groupSize,
        matchType,
        winRates,
        pairingCounts,
        partnerSets,
        bandRoster,
        settings.balanceWeight
      );
      if (bothNeighborsAttempt && hasFreshArrangement(bothNeighborsAttempt)) {
        return { levelTier: "ADJACENT_LEVEL", pool: bothNeighborsPool, arrangements: bothNeighborsAttempt, anchorLevel };
      }
    } else {
      const primaryPool = poolForLevel(
        eligible,
        (e) => isLevelOrDirectionalNeighbor(e.player.skillLevel, targetLevel, direction),
        settings.maxWindowSize
      );
      const primaryAttempt = attemptLevelTier(
        primaryPool,
        "ADJACENT_LEVEL",
        groupSize,
        matchType,
        winRates,
        pairingCounts,
        partnerSets,
        bandRoster,
        settings.balanceWeight
      );
      if (primaryAttempt && hasFreshArrangement(primaryAttempt)) {
        return { levelTier: "ADJACENT_LEVEL", pool: primaryPool, arrangements: primaryAttempt, anchorLevel };
      }

      // Reciprocal fallback: the other neighbor, but only candidates who
      // are themselves reaching the same direction (so a winning player
      // never gets thrown against someone who's struggling just to fill a
      // slot — only a neighbor who'd genuinely want the tougher game).
      const fallbackDirection: Direction = direction === "UP" ? "DOWN" : "UP";
      const fallbackPool = poolForLevel(
        eligible,
        (e) => {
          const level = e.player.skillLevel;
          if (level === targetLevel) return true;
          if (!isLevelOrDirectionalNeighbor(level, targetLevel, fallbackDirection)) return false;
          return escalationDirection(e.player.id, winRates, gamesPlayedMap) === direction;
        },
        settings.maxWindowSize
      );
      const fallbackAttempt = attemptLevelTier(
        fallbackPool,
        "ADJACENT_LEVEL",
        groupSize,
        matchType,
        winRates,
        pairingCounts,
        partnerSets,
        bandRoster,
        settings.balanceWeight
      );
      if (fallbackAttempt && hasFreshArrangement(fallbackAttempt)) {
        return { levelTier: "ADJACENT_LEVEL", pool: fallbackPool, arrangements: fallbackAttempt, anchorLevel };
      }
    }
  }

  const pool = sortByArrival(eligible)
    .slice(0, effectiveWindowSize(waitingCount, settings))
    .map((entry) => entry.player);

  if (pool.length < groupSize) {
    return { levelTier: "UNRESTRICTED", pool, arrangements: [], anchorLevel };
  }

  const groups = combinations(pool, groupSize);
  const genderTier = pickGenderTier(groups, matchType);
  const raw = buildArrangements(groups, matchType, genderTier);
  const arrangements = raw.map((r) =>
    scoreArrangement(r, matchType, winRates, pairingCounts, partnerSets, bandRoster, settings.balanceWeight)
  );
  return { levelTier: "UNRESTRICTED", pool, arrangements, anchorLevel };
}

function resolveLockedTier(
  pool: Player[],
  lockedPlacement: LockedPlacement,
  lockedPlayers: Player[],
  numToPick: number,
  matchType: MatchType,
  winRates: Map<string, number>,
  pairingCounts: Map<string, number>,
  partnerSets: Map<string, Set<string>>,
  bandRoster: Map<SkillLevel, Set<string>>,
  balanceWeight: number
): { levelTier: LevelTier; arrangements: Arrangement[] } {
  if (pool.length < numToPick) {
    return { levelTier: "UNRESTRICTED", arrangements: [] };
  }

  const newCombos = combinations(pool, numToPick);
  const tiers: LevelTier[] = ["EXACT_LEVEL", "ADJACENT_LEVEL", "UNRESTRICTED"];

  for (const tier of tiers) {
    const filteredCombos =
      tier === "UNRESTRICTED"
        ? newCombos
        : newCombos.filter((combo) => levelTierMatches(tier, [...lockedPlayers, ...combo]));
    if (filteredCombos.length === 0) continue;

    const fullGroups = filteredCombos.map((combo) => [...lockedPlayers, ...combo]);
    const genderTier = pickGenderTier(fullGroups, matchType);
    const raw = buildArrangementsLocked(lockedPlacement, filteredCombos, tier, genderTier);
    if (raw.length === 0) continue;

    const scored = raw.map((r) =>
      scoreArrangement(r, matchType, winRates, pairingCounts, partnerSets, bandRoster, balanceWeight)
    );
    if (tier !== "UNRESTRICTED" && !hasFreshArrangement(scored)) continue;

    return { levelTier: tier, arrangements: scored };
  }

  return { levelTier: "UNRESTRICTED", arrangements: [] };
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
