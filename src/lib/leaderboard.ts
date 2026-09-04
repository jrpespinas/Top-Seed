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
  /** Wins in doubles where the partner sat below this player on the ladder. */
  carryWins: number;
  /** Σ rungs carried across those wins — magnitude, and the tiebreak. */
  carryRungs: number;
  timeOnCourtMs: number;
  /**
   * When this player entered the session — the final ranking tiebreak.
   *
   * Never null: a row exists only because the player appeared in at least one
   * completed match, so their first match is always available as a fallback.
   */
  checkInAt: string;
  /**
   * Always sequential — 1, 2, 3, 4 — never competition ranking with shared
   * places. Two players on identical records are separated by name rather
   * than presented as joint, so a reader never has to decode a "T-" prefix
   * or wonder why two rows carry the same number.
   */
  rank: number;
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

function summarize(
  aggregate: Aggregate,
  checkIn: string | undefined
): Omit<LeaderboardRow, "rank"> {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let bonusPoints = 0;
  let timeOnCourtMs = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let carryWins = 0;
  let carryRungs = 0;
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
      // Deliberately NOT gated on being the underdog, unlike the points bonus.
      // The points gate exists so an easy win can't be paid twice; this award
      // asks a plainer question — did you win with someone below you? — and
      // beating a weak pair while carrying a weak partner is still carrying.
      const mate = side.find((q) => q.id !== player.id);
      if (mate) {
        const rungs = SKILL_RANK[mate.skillLevel] - SKILL_RANK[player.skillLevel];
        if (rungs > 0) {
          carryWins++;
          carryRungs += rungs;
        }
      }
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
    carryWins,
    carryRungs,
    timeOnCourtMs,
    // Real check-in when the session store knows it, otherwise this player's
    // first match — a close proxy, and the reason this can never be null.
    // `played` is chronological and non-empty by construction: an aggregate
    // only exists because an appearance was recorded for it.
    checkInAt: checkIn ?? aggregate.played[0].match.startedAt,
  };
}

export function computeLeaderboard(
  matches: MatchRecord[],
  options: {
    matchType: MatchTypeFilter;
    sort: LeaderboardSort;
    /** Player id → ISO check-in instant. See `useSessionCheckIns`. */
    checkInByPlayer?: Map<string, string>;
  }
): LeaderboardRow[] {
  const rows = Array.from(collectAppearances(matches, options.matchType).values()).map((a) =>
    summarize(a, options.checkInByPlayer?.get(a.playerId))
  );

  // Points lead; form breaks ties. Both are shown, so the tiebreak is never
  // invisible — a reader can always see why one row sits above another.
  //
  // Check-in time is the final tiebreak, earliest first. Ranks are sequential,
  // so two identical records must still be ordered somehow — and of the
  // available answers this is the only one that rewards something the player
  // actually did. Turning up first and playing all night is worth more than
  // an alphabetical accident, and it quietly encourages the behaviour an
  // organiser wants. Name only breaks a tie between two identical check-ins.
  const compare = (a: (typeof rows)[number], b: (typeof rows)[number]): number => {
    const primary =
      options.sort === "wins"
        ? b.wins - a.wins
        : options.sort === "matchesPlayed"
        ? b.matchesPlayed - a.matchesPlayed
        : options.sort === "form"
        ? b.form - a.form
        : b.points - a.points;
    return (
      primary ||
      b.form - a.form ||
      b.matchesPlayed - a.matchesPlayed ||
      a.checkInAt.localeCompare(b.checkInAt) ||
      a.name.localeCompare(b.name)
    );
  };

  const sorted = [...rows].sort(compare);

  // Sequential throughout — 1, 2, 3, 4 — never shared places.
  //
  // Competition ranking was here first (1, 2, 2, 4, with a "T-" prefix on the
  // joint rows), on the reasoning that manufacturing a split between identical
  // records is a small lie. It was replaced because the cost landed on every
  // reader instead: a column that is mostly plain numbers and occasionally
  // "T-3" makes people stop and decode rather than scan, and that prefix now
  // also reaches a printed sheet posted to people with no way to ask what it
  // means. Identical records are separated by name in `compare` above, so the
  // order is at least deterministic and explicable.
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

export type HonorKind = "upset" | "streak" | "carry" | "onCourt" | "pair";

export interface Honor {
  kind: HonorKind;
  /** The award's name, e.g. "Giant Killer". */
  label: string;
  playerId: string;
  name: string;
  skillLevel: SkillLevel;
  /** The fact itself, already formatted: "5 wins in a row", "9 matches played". */
  detail: string;
  /** How far clear of the next-best player this is. See `selectHonors`. */
  standout: number;
}

/**
 * Each award's value for one player, plus the floor it has to clear.
 *
 * The floor is what stops trivia winning a slot: one win is not a run of form,
 * and one match is not an endurance record.
 */
const HONOR_DEFINITIONS: {
  kind: HonorKind;
  label: string;
  minimum: number;
  value: (row: LeaderboardRow) => number;
  detail: (row: LeaderboardRow) => string;
}[] = [
  {
    kind: "upset",
    label: "Giant Killer",
    minimum: 1,
    value: (r) => r.bestUpset?.bonus ?? 0,
    detail: (r) => `beat ${formatNames(r.bestUpset!.opponentNames)}`,
  },
  {
    kind: "streak",
    label: "On Fire",
    // Three, matching the row chip. Two consecutive wins happens constantly in
    // a session of four-match evenings; awarding "On Fire" for it would spend
    // one of three slots on something unremarkable.
    minimum: 3,
    value: (r) => r.longestStreak,
    detail: (r) => `${r.longestStreak} wins in a row`,
  },
  {
    kind: "carry",
    label: "The Carry",
    minimum: 2,
    value: (r) => r.carryWins,
    detail: (r) => `${r.carryWins} wins with weaker partners`,
  },
  {
    kind: "onCourt",
    label: "The Android",
    minimum: 2,
    value: (r) => r.matchesPlayed,
    detail: (r) => `${r.matchesPlayed} matches played`,
  },
  {
    kind: "pair",
    label: "The Duo",
    minimum: 2,
    value: (r) => r.bestPartner?.wins ?? 0,
    detail: (r) => `${r.bestPartner!.wins} wins with ${r.bestPartner!.partnerName}`,
  },
];

/** Order used only to break a tie between two equally unusual awards. */
const HONOR_TIEBREAK: HonorKind[] = HONOR_DEFINITIONS.map((d) => d.kind);

/**
 * Picks the session's awards, most remarkable first.
 *
 * **Ranked by how far clear the leader is, not by a fixed priority.** The first
 * version walked a hardcoded list — upset, then streak, then matches — which
 * meant a one-rung upset always outranked a six-match winning streak purely
 * because of list position. That is backwards: the streak is plainly the more
 * remarkable thing that happened.
 *
 * `standout` is the leader's value divided by the runner-up's, so it asks the
 * same question of every award regardless of its units: *how far clear of the
 * next person is this?* A 3-rung upset where nobody else managed one scores 3;
 * a 6-match streak where the next best is 3 scores 2; the busiest player at 9
 * matches with someone else on 8 scores 1.1. Dimensionless, so streaks and
 * upsets and match counts compare directly, and the same relative reasoning as
 * the long-match marker on the Matches page.
 *
 * The podium is eligible — see the note on the apex in `04-leaderboard.md`.
 * One award per player still holds: two adjacent cards on the same name looks
 * like a rendering fault rather than a tribute.
 */
export function selectHonors(rows: LeaderboardRow[], slots: number): Honor[] {
  const candidates: (Honor & { value: number })[] = [];

  for (const def of HONOR_DEFINITIONS) {
    const ranked = rows
      .map((row) => ({ row, value: def.value(row) }))
      .filter((c) => c.value >= def.minimum)
      .sort((a, b) => b.value - a.value);

    const leader = ranked[0];
    if (!leader) continue;

    // No runner-up means nobody else did this at all, so the leader's own
    // value is the margin. Flooring at 1 keeps the ratio finite.
    const runnerUp = ranked.find((c) => c.row.playerId !== leader.row.playerId)?.value ?? 0;
    candidates.push({
      kind: def.kind,
      label: def.label,
      playerId: leader.row.playerId,
      name: leader.row.name,
      skillLevel: leader.row.skillLevel,
      detail: def.detail(leader.row),
      standout: leader.value / Math.max(1, runnerUp),
      value: leader.value,
    });
  }

  candidates.sort(
    (a, b) =>
      b.standout - a.standout ||
      HONOR_TIEBREAK.indexOf(a.kind) - HONOR_TIEBREAK.indexOf(b.kind)
  );

  const honors: Honor[] = [];
  const claimed = new Set<string>();
  for (const candidate of candidates) {
    if (honors.length >= slots) break;
    if (claimed.has(candidate.playerId)) continue;
    claimed.add(candidate.playerId);
    const { value: _value, ...honor } = candidate;
    void _value;
    honors.push(honor);
  }
  return honors;
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
 *
 * The two suppression flags exist because the podium can now hold honors: if
 * the champion also takes a card directly below this line, the line must not
 * narrate the fact that card is already showing.
 *
 * `suppressStreak` covers both opening clauses, not just the obviously
 * streak-shaped one. "Won all N" requires zero losses and zero draws, which
 * means the record and the longest streak are the same number — so beside a
 * card reading "5 wins in a row" it is the identical fact in different words.
 */
export function championSummary(
  row: LeaderboardRow,
  options: { suppressUpset?: boolean; suppressStreak?: boolean } = {}
): string | null {
  if (row.matchesPlayed === 0) return null;

  const parts: string[] = [];
  if (!options.suppressStreak) {
    if (row.losses === 0 && row.draws === 0 && row.wins > 1) {
      parts.push(`Won all ${row.wins}`);
    } else if (row.longestStreak >= 3) {
      parts.push(`${row.longestStreak} straight at their best`);
    }
  }

  if (row.bestUpset && row.bestUpset.bonus > 0 && !options.suppressUpset) {
    parts.push(`beat ${formatNames(row.bestUpset.opponentNames)} along the way`);
  } else if (row.bestPartner && row.bestPartner.wins >= 2) {
    parts.push(`${row.bestPartner.wins} of them with ${row.bestPartner.partnerName}`);
  }

  if (parts.length === 0) return null;
  return `${parts.join(", ")}.`;
}
