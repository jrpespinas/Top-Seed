import type { MatchRecord, MatchType } from "@/types";

export type LeaderboardSort = "wins" | "winRate" | "matchesPlayed";
export type MatchTypeFilter = MatchType | "ALL";

export interface LeaderboardRow {
  playerId: string;
  name: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number; // 0-1
  rank: number;
  // True when one or more other rows share this exact rank (same sort metric
  // AND the same matches-played tiebreak) — the UI shows a "T-" prefix so a
  // manufactured, confident-looking split is never presented for identical records.
  isTied: boolean;
}

// Only COMPLETED matches count — voided matches are excluded from every
// calculation here, per docs/PRD.md's leaderboard acceptance criteria. This
// function itself is session-agnostic; both the /leaderboard page and the
// per-session Excel export (export-session.ts) pre-filter `matches` to one
// session before calling it, rather than this function knowing about sessions.
export function computeLeaderboard(
  matches: MatchRecord[],
  options: { matchType: MatchTypeFilter; sort: LeaderboardSort }
): LeaderboardRow[] {
  const stats = new Map<string, { name: string; wins: number; draws: number; losses: number }>();

  for (const match of matches) {
    if (match.status !== "COMPLETED" || !match.result) continue;
    if (options.matchType !== "ALL" && match.matchType !== options.matchType) continue;

    for (const player of match.sideA) {
      const entry = stats.get(player.id) ?? { name: player.name, wins: 0, draws: 0, losses: 0 };
      if (match.result === "SIDE_A") entry.wins++;
      else if (match.result === "DRAW") entry.draws++;
      else entry.losses++;
      stats.set(player.id, entry);
    }
    for (const player of match.sideB) {
      const entry = stats.get(player.id) ?? { name: player.name, wins: 0, draws: 0, losses: 0 };
      if (match.result === "SIDE_B") entry.wins++;
      else if (match.result === "DRAW") entry.draws++;
      else entry.losses++;
      stats.set(player.id, entry);
    }
  }

  type Aggregate = Omit<LeaderboardRow, "rank" | "isTied">;

  const compare = (a: Aggregate, b: Aggregate): number => {
    const primary =
      options.sort === "wins"
        ? b.wins - a.wins
        : options.sort === "winRate"
        ? b.winRate - a.winRate
        : b.matchesPlayed - a.matchesPlayed;
    // Ties broken by matches played — more matches ranks higher, per docs/PRD.md.
    return primary !== 0 ? primary : b.matchesPlayed - a.matchesPlayed;
  };

  const sorted: Aggregate[] = Array.from(stats.entries())
    .map(([playerId, s]) => {
      const matchesPlayed = s.wins + s.draws + s.losses;
      return {
        playerId,
        name: s.name,
        matchesPlayed,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        winRate: matchesPlayed > 0 ? s.wins / matchesPlayed : 0,
      };
    })
    .sort(compare);

  // Competition ranking (1, 2, 2, 4 — not 1, 2, 2, 3): a row shares the
  // previous row's rank only when it's a genuine tie on every sort criterion,
  // including the matches-played tiebreak. Never manufacture a confident
  // split between statistically-identical records.
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
