import type { MatchRecord, MatchType, Player, Side, SkillLevel } from "@/types";
import { SKILL_RANK } from "./skill-level";

export type LeaderboardSort = "points" | "form" | "wins" | "matchesPlayed";
export type MatchTypeFilter = MatchType | "ALL";

export interface UpsetRecord {
  /** Bonus points this single win earned, 1-3. */
  bonus: number;
  opponentNames: string[];
  /** Strongest rung faced, for copy like "beat two Advanced players". */
  opponentLevel: SkillLevel;
}

export interface PartnerRecord {
  partnerId: string;
  partnerName: string;
  played: number;
  wins: number;
}

export interface LeaderboardRow {
  playerId: string;
  name: string;
  skillLevel: SkillLevel;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  /** 3·W + 1·D. */
  resultPoints: number;
  /** Σ of per-match difficulty bonuses. */
  bonusPoints: number;
  /** resultPoints + bonusPoints — the headline number. */
  points: number;
  /** Shrunk win share, 0-1. See `form` below. */
  form: number;
  /** Naive wins/played. Not ranked on; kept for the Excel export. */
  winRate: number;
  /** Consecutive wins ending at this player's most recent match. */
  currentStreak: number;
  longestStreak: number;
  /** The single win that earned the most bonus, if any earned one at all. */
  bestUpset: UpsetRecord | null;
  /** Most wins alongside one partner, minimum two matches together. */
  bestPartner: PartnerRecord | null;
  timeOnCourtMs: number;
  rank: number;
  /**
   * True when another row shares this exact rank on every criterion — the UI
   * shows a "T-" prefix so a manufactured, confident-looking split is never
   * presented for identical records. Far rarer since points replaced a
   * percentage: three decimal-identical rates are common, three identical
   * point totals with identical form much less so.
   */
  isTied: boolean;
}

/**
 * Draws are worth a third of a win, matching every league table in the world.
 *
 * They were previously worth nothing: `winRate` divided wins by a denominator
 * that counted draws, and the Wilson bound took `(wins, played)` directly, so a
 * draw scored exactly as a loss. An undefeated 3W-1D-0L and a beaten 3W-0D-1L
 * came out identical and tied.
 */
const WIN_POINTS = 3;
const DRAW_POINTS = 1;

/**
 * No single match may be worth more than two clean wins.
 *
 * In practice this rarely binds: `isAdjacentLevel` constrains suggested
 * matchups to one rung apart, so the typical bonus is 0 or 1. The cap is a
 * guard against hand-dragged extremes — a Casual pair beating two Advanced
 * players is the most remarkable thing that can happen in a session, and it
 * should be worth a lot, but not a third of a champion's whole day.
 */
const MAX_MATCH_BONUS = 3;

/** Pseudo-matches added to every player before computing `form`. */
const PRIOR_MATCHES = 2;
const PRIOR_WINS = 1;

function avgRank(players: Player[]): number {
  if (players.length === 0) return 0;
  return players.reduce((sum, p) => sum + SKILL_RANK[p.skillLevel], 0) / players.length;
}

/**
 * Bonus points for winning one match, given who you played with and against.
 *
 * Two independent, non-overlapping facts:
 *
 * - **difficulty** — how many rungs stronger the opposing side was than yours.
 *   `SKILL_RANK` counts upward as players get weaker, so a positive difference
 *   means your side was the underdog.
 * - **carry** — how many rungs weaker your partner was than you.
 *
 * Bonus only, never a penalty. If beating a weaker player or partnering with
 * one cost you rating, the strongest players would stop mixing to protect a
 * number, and the session would get socially worse. An inaccurate ranking is a
 * far cheaper problem than a leaderboard that discourages people from playing
 * with beginners.
 *
 * Carry is gated on your side actually being the underdog. Without the gate, an
 * Advanced player paired with a Casual against two Casuals collects the full
 * carry bonus for a match they were always going to win. The gate reads as one
 * sentence: you only earn carry credit when your pair was the underdog.
 */
function matchBonus(player: Player, side: Player[], opponents: Player[]): number {
  const sideAvg = avgRank(side);
  const oppAvg = avgRank(opponents);
  const difficulty = Math.max(0, Math.round(sideAvg - oppAvg));

  const partner = side.find((p) => p.id !== player.id);
  const carry =
    partner && sideAvg > oppAvg
      ? Math.max(0, SKILL_RANK[partner.skillLevel] - SKILL_RANK[player.skillLevel])
      : 0;

  return Math.min(MAX_MATCH_BONUS, difficulty + carry);
}

/**
 * Was this match an upset, and by how much?
 *
 * The match-level counterpart to `matchBonus`, sharing its `difficulty` term so
 * the Matches page and the Leaderboard can never disagree about what an upset
 * is. It deliberately omits the `carry` term: carry describes one player's
 * position within their own pair, which has no meaning for the match as a whole.
 *
 * Returns null for draws, voided matches, and any win where the victors were
 * not the weaker side.
 */
export function matchUpset(match: MatchRecord): { side: Side; bonus: number } | null {
  if (match.status !== "COMPLETED" || !match.result || match.result === "DRAW") return null;
  const winnersAreA = match.result === "SIDE_A";
  const winners = winnersAreA ? match.sideA : match.sideB;
  const losers = winnersAreA ? match.sideB : match.sideA;
  const difficulty = Math.max(0, Math.round(avgRank(winners) - avgRank(losers)));
  if (difficulty === 0) return null;
  return { side: winnersAreA ? "A" : "B", bonus: Math.min(MAX_MATCH_BONUS, difficulty) };
}

/**
 * Shrunk win share — every player starts the day 1-1.
 *
 * This replaced a Wilson score lower bound, which was the right idea applied at
 * the wrong sample size. Wilson was built for samples in the hundreds; a
 * session produces two to eight matches per player, and at that size the
 * confidence correction stops adjusting the signal and becomes the signal: a
 * perfect 5-0 came out at 57%, below what most people would call average, and
 * eleven players compressed into a 57-21 band with four-way ties.
 *
 * Adding two pseudo-matches achieves the same goal — an unproven record can't
 * out-rank a real one — while staying legible at small n (5-0 reads 86%,
 * 20-2 reads 87.5%, so the veteran still edges ahead). It also explains itself
 * in one sentence, which the Wilson bound never could.
 */
function shrunkForm(wins: number, draws: number, played: number): number {
  return (wins + 0.5 * draws + PRIOR_WINS) / (played + PRIOR_MATCHES);
}

interface PlayedMatch {
  match: MatchRecord;
  side: Player[];
  opponents: Player[];
  outcome: "W" | "D" | "L";
}

interface Aggregate {
  playerId: string;
  name: string;
  skillLevel: SkillLevel;
  played: PlayedMatch[];
}

function collectAppearances(
  matches: MatchRecord[],
  matchType: MatchTypeFilter
): Map<string, Aggregate> {
  const byPlayer = new Map<string, Aggregate>();

  // Chronological, so streaks and "current form" mean what they say. Records
  // arrive newest-first from the match log.
  const ordered = [...matches].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const match of ordered) {
    // Only COMPLETED matches count — voided matches are excluded from every
    // calculation here, per docs/PRD.md's leaderboard acceptance criteria.
    if (match.status !== "COMPLETED" || !match.result) continue;
    if (matchType !== "ALL" && match.matchType !== matchType) continue;

    const sides: { players: Player[]; opponents: Player[]; won: boolean }[] = [
      { players: match.sideA, opponents: match.sideB, won: match.result === "SIDE_A" },
      { players: match.sideB, opponents: match.sideA, won: match.result === "SIDE_B" },
    ];

    for (const { players, opponents, won } of sides) {
      for (const player of players) {
        const entry = byPlayer.get(player.id) ?? {
          playerId: player.id,
          name: player.name,
          skillLevel: player.skillLevel,
          played: [],
        };
        // Later appearances win, so a level changed mid-session shows current.
        entry.name = player.name;
        entry.skillLevel = player.skillLevel;
        entry.played.push({
          match,
          side: players,
          opponents,
          outcome: match.result === "DRAW" ? "D" : won ? "W" : "L",
        });
        byPlayer.set(player.id, entry);
      }
    }
  }

  return byPlayer;
}

function summarize(aggregate: Aggregate): Omit<LeaderboardRow, "rank" | "isTied"> {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let bonusPoints = 0;
  let timeOnCourtMs = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let bestUpset: UpsetRecord | null = null;

  const partners = new Map<string, PartnerRecord>();

  for (const { match, side, opponents, outcome } of aggregate.played) {
    if (outcome === "W") wins++;
    else if (outcome === "D") draws++;
    else losses++;

    if (outcome === "W") {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
      const player = side.find((p) => p.id === aggregate.playerId)!;
      const bonus = matchBonus(player, side, opponents);
      bonusPoints += bonus;
      if (bonus > 0 && (!bestUpset || bonus > bestUpset.bonus)) {
        bestUpset = {
          bonus,
          opponentNames: opponents.map((o) => o.name),
          // Strongest opponent faced — lowest SKILL_RANK.
          opponentLevel: opponents.reduce((strongest, o) =>
            SKILL_RANK[o.skillLevel] < SKILL_RANK[strongest.skillLevel] ? o : strongest
          ).skillLevel,
        };
      }
    } else {
      currentStreak = 0;
    }

    if (match.endedAt) {
      const ms = new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime();
      if (ms > 0) timeOnCourtMs += ms;
    }

    for (const mate of side) {
      if (mate.id === aggregate.playerId) continue;
      const record = partners.get(mate.id) ?? {
        partnerId: mate.id,
        partnerName: mate.name,
        played: 0,
        wins: 0,
      };
      record.partnerName = mate.name;
      record.played++;
      if (outcome === "W") record.wins++;
      partners.set(mate.id, record);
    }
  }

  const bestPartner =
    Array.from(partners.values())
      .filter((p) => p.played >= 2)
      .sort((a, b) => b.wins - a.wins || b.played - a.played)[0] ?? null;

  const matchesPlayed = wins + draws + losses;
  const resultPoints = wins * WIN_POINTS + draws * DRAW_POINTS;

  return {
    playerId: aggregate.playerId,
    name: aggregate.name,
    skillLevel: aggregate.skillLevel,
    matchesPlayed,
    wins,
    draws,
    losses,
    resultPoints,
    bonusPoints,
    points: resultPoints + bonusPoints,
    form: shrunkForm(wins, draws, matchesPlayed),
    winRate: matchesPlayed > 0 ? wins / matchesPlayed : 0,
    currentStreak,
    longestStreak,
    bestUpset,
    bestPartner,
    timeOnCourtMs,
  };
}

export function computeLeaderboard(
  matches: MatchRecord[],
  options: { matchType: MatchTypeFilter; sort: LeaderboardSort }
): LeaderboardRow[] {
  const rows = Array.from(collectAppearances(matches, options.matchType).values()).map(summarize);

  // Points lead; form breaks ties. Both are shown, so the tiebreak is never
  // invisible — a reader can always see why one row sits above another.
  const compare = (a: (typeof rows)[number], b: (typeof rows)[number]): number => {
    const primary =
      options.sort === "wins"
        ? b.wins - a.wins
        : options.sort === "matchesPlayed"
        ? b.matchesPlayed - a.matchesPlayed
        : options.sort === "form"
        ? b.form - a.form
        : b.points - a.points;
    return primary !== 0 ? primary : b.form - a.form || b.matchesPlayed - a.matchesPlayed;
  };

  const sorted = [...rows].sort(compare);

  // Competition ranking (1, 2, 2, 4 — not 1, 2, 2, 3): a row shares the
  // previous row's rank only on a genuine tie across every criterion.
  const rankByPlayer = new Map<string, number>();
  sorted.forEach((row, i) => {
    if (i > 0 && compare(sorted[i - 1], row) === 0) {
      rankByPlayer.set(row.playerId, rankByPlayer.get(sorted[i - 1].playerId)!);
    } else {
      rankByPlayer.set(row.playerId, i + 1);
    }
  });

  const rankCounts = new Map<number, number>();
  for (const rank of Array.from(rankByPlayer.values())) {
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
  }

  return sorted.map((row) => {
    const rank = rankByPlayer.get(row.playerId)!;
    return { ...row, rank, isTied: (rankCounts.get(rank) ?? 0) > 1 };
  });
}

export type HonorKind = "upset" | "streak" | "onCourt" | "pair";

export interface Honor {
  kind: HonorKind;
  label: string;
  playerId: string;
  name: string;
  skillLevel: SkillLevel;
  /** The fact itself, already formatted: "W4", "beat Tita & Karen", "6 matches". */
  detail: string;
}

const MIN_HONOR_STREAK = 2;
const MIN_HONOR_MATCHES = 2;

/**
 * Picks the honor slots that flank the podium.
 *
 * Two rules carry the design:
 *
 * 1. **Anyone already on the podium is excluded.** The champion of a 5-0
 *    session also owns the longest streak by construction; awarding it to them
 *    would recognise four people where the layout has room for five. Dropping
 *    to the best streak outside the top three is what makes the apex five
 *    distinct names.
 * 2. **Honors come from a priority pool, and empty ones are skipped.** Suggested
 *    matchups are adjacency-constrained, so plenty of sessions produce no upset
 *    at all. Rather than render a slot with nothing in it, the next available
 *    honor takes its place.
 */
export function selectHonors(rows: LeaderboardRow[], slots: number, excludeIds: Set<string>): Honor[] {
  const eligible = rows.filter((r) => !excludeIds.has(r.playerId));
  const honors: Honor[] = [];
  const claimed = new Set<string>();

  const push = (honor: Honor | null) => {
    if (!honor || claimed.has(honor.playerId) || honors.length >= slots) return;
    claimed.add(honor.playerId);
    honors.push(honor);
  };

  const best = <T>(items: T[], score: (item: T) => number): T | null => {
    let top: T | null = null;
    let topScore = 0;
    for (const item of items) {
      const value = score(item);
      if (value > topScore) {
        top = item;
        topScore = value;
      }
    }
    return top;
  };

  const upsetRow = best(
    eligible.filter((r) => !claimed.has(r.playerId)),
    (r) => r.bestUpset?.bonus ?? 0
  );
  if (upsetRow?.bestUpset) {
    push({
      kind: "upset",
      label: "Biggest upset",
      playerId: upsetRow.playerId,
      name: upsetRow.name,
      skillLevel: upsetRow.skillLevel,
      detail: `beat ${formatNames(upsetRow.bestUpset.opponentNames)}`,
    });
  }

  const streakRow = best(
    eligible.filter((r) => !claimed.has(r.playerId) && r.longestStreak >= MIN_HONOR_STREAK),
    (r) => r.longestStreak
  );
  if (streakRow) {
    push({
      kind: "streak",
      label: "Longest streak",
      playerId: streakRow.playerId,
      name: streakRow.name,
      skillLevel: streakRow.skillLevel,
      detail: `${streakRow.longestStreak} wins in a row`,
    });
  }

  const courtRow = best(
    eligible.filter((r) => !claimed.has(r.playerId) && r.matchesPlayed >= MIN_HONOR_MATCHES),
    (r) => r.matchesPlayed
  );
  if (courtRow) {
    push({
      kind: "onCourt",
      label: "Most on court",
      playerId: courtRow.playerId,
      name: courtRow.name,
      skillLevel: courtRow.skillLevel,
      detail: `${courtRow.matchesPlayed} matches`,
    });
  }

  const pairRow = best(
    eligible.filter((r) => !claimed.has(r.playerId) && (r.bestPartner?.wins ?? 0) >= MIN_HONOR_MATCHES),
    (r) => r.bestPartner?.wins ?? 0
  );
  if (pairRow?.bestPartner) {
    push({
      kind: "pair",
      label: "Best pair",
      playerId: pairRow.playerId,
      name: pairRow.name,
      skillLevel: pairRow.skillLevel,
      detail: `${pairRow.bestPartner.wins} wins with ${pairRow.bestPartner.partnerName}`,
    });
  }

  return honors.slice(0, slots);
}

function formatNames(names: string[]): string {
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/**
 * The champion's one line, assembled from what actually happened.
 *
 * Returns null rather than a generic filler when nothing specific is true —
 * an empty line reads better than "had a good session".
 */
export function championSummary(row: LeaderboardRow): string | null {
  if (row.matchesPlayed === 0) return null;

  const parts: string[] = [];
  if (row.losses === 0 && row.draws === 0 && row.wins > 1) {
    parts.push(`Won all ${row.wins}`);
  } else if (row.longestStreak >= 3) {
    parts.push(`${row.longestStreak} straight at their best`);
  }

  if (row.bestUpset && row.bestUpset.bonus > 0) {
    parts.push(`beat ${formatNames(row.bestUpset.opponentNames)} along the way`);
  } else if (row.bestPartner && row.bestPartner.wins >= 2) {
    parts.push(`${row.bestPartner.wins} of them with ${row.bestPartner.partnerName}`);
  }

  if (parts.length === 0) return null;
  return `${parts.join(", ")}.`;
}
