import type { Match, MatchOutcome, PlayerStats, WinningTeam } from "../types/index.js";
import {
  applyRatingDelta,
  computeMatchRatingDeltas,
  type TeamRatingInput,
} from "../ratings/index.js";
import type { RatingMode } from "../types/index.js";

export function computeWinRate(
  wins: number,
  losses: number,
  draws: number,
): number | null {
  const denominator = wins + losses + draws;
  if (denominator === 0) {
    return null;
  }
  return wins / denominator;
}

export function createEmptyStats(playerProfileId: string): PlayerStats {
  return {
    playerProfileId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };
}

export function applyOutcomeToPlayerStats(
  stats: PlayerStats,
  outcome: MatchOutcome,
  team: "team_one" | "team_two",
  winningTeam: WinningTeam | null,
): PlayerStats {
  if (outcome === "cancelled") {
    return stats;
  }

  const next = { ...stats };

  if (
    outcome === "team_one_win" ||
    outcome === "team_two_win" ||
    outcome === "draw" ||
    outcome === "unscored"
  ) {
    next.matchesPlayed += 1;
  }

  if (outcome === "draw") {
    next.draws += 1;
    return next;
  }

  if (outcome === "unscored") {
    return next;
  }

  if (outcome === "team_one_win" && winningTeam === "team_one") {
    next.wins += team === "team_one" ? 1 : 0;
    next.losses += team === "team_two" ? 1 : 0;
  } else if (outcome === "team_two_win" && winningTeam === "team_two") {
    next.wins += team === "team_two" ? 1 : 0;
    next.losses += team === "team_one" ? 1 : 0;
  }

  return next;
}

export interface CompletedMatchRecord {
  id: string;
  completedAt: string;
  outcome: MatchOutcome;
  winningTeam: WinningTeam | null;
  participants: Array<{
    playerProfileId: string;
    team: "team_one" | "team_two";
    ratingBefore: number;
  }>;
}

export interface SessionRecomputeResult {
  statsByPlayer: Map<string, PlayerStats>;
  ratingsByPlayer: Map<string, number>;
  matchDeltas: Map<string, Map<string, number>>;
}

function sortMatchesChronologically(matches: CompletedMatchRecord[]): CompletedMatchRecord[] {
  return [...matches].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export function recomputeSessionFromMatches(
  matches: CompletedMatchRecord[],
  initialRatings: Map<string, number>,
  ratingMode: RatingMode,
): SessionRecomputeResult {
  const statsByPlayer = new Map<string, PlayerStats>();
  const ratingsByPlayer = new Map(initialRatings);
  const matchDeltas = new Map<string, Map<string, number>>();

  for (const sorted of sortMatchesChronologically(matches)) {
    if (sorted.outcome === "cancelled") {
      continue;
    }

    for (const participant of sorted.participants) {
      if (!statsByPlayer.has(participant.playerProfileId)) {
        statsByPlayer.set(
          participant.playerProfileId,
          createEmptyStats(participant.playerProfileId),
        );
      }
      const current = statsByPlayer.get(participant.playerProfileId)!;
      statsByPlayer.set(
        participant.playerProfileId,
        applyOutcomeToPlayerStats(
          current,
          sorted.outcome,
          participant.team,
          sorted.winningTeam,
        ),
      );
    }

    const teamOne = sorted.participants.filter((p) => p.team === "team_one");
    const teamTwo = sorted.participants.filter((p) => p.team === "team_two");
    const ratingInput: TeamRatingInput = {
      teamOneRatings: teamOne.map(
        (p) => ratingsByPlayer.get(p.playerProfileId) ?? p.ratingBefore,
      ),
      teamTwoRatings: teamTwo.map(
        (p) => ratingsByPlayer.get(p.playerProfileId) ?? p.ratingBefore,
      ),
    };

    const deltas = computeMatchRatingDeltas(
      ratingMode,
      sorted.outcome,
      ratingInput,
      sorted.winningTeam,
    );

    if (deltas) {
      const perMatch = new Map<string, number>();
      teamOne.forEach((p, index) => {
        const before = ratingsByPlayer.get(p.playerProfileId) ?? p.ratingBefore;
        const delta = deltas.teamOneDeltas[index] ?? 0;
        perMatch.set(p.playerProfileId, delta);
        ratingsByPlayer.set(p.playerProfileId, applyRatingDelta(before, delta));
      });
      teamTwo.forEach((p, index) => {
        const before = ratingsByPlayer.get(p.playerProfileId) ?? p.ratingBefore;
        const delta = deltas.teamTwoDeltas[index] ?? 0;
        perMatch.set(p.playerProfileId, delta);
        ratingsByPlayer.set(p.playerProfileId, applyRatingDelta(before, delta));
      });
      matchDeltas.set(sorted.id, perMatch);
    }
  }

  return { statsByPlayer, ratingsByPlayer, matchDeltas };
}

export function matchToCompletedRecord(match: Match, ratings: Map<string, number>): CompletedMatchRecord | null {
  if (match.status !== "completed" || !match.outcome || !match.completedAt) {
    return null;
  }

  return {
    id: match.id,
    completedAt: match.completedAt,
    outcome: match.outcome,
    winningTeam: match.winningTeam,
    participants: match.participants.map((p) => ({
      playerProfileId: p.playerProfileId,
      team: p.team,
      ratingBefore: ratings.get(p.playerProfileId) ?? 3.0,
    })),
  };
}
