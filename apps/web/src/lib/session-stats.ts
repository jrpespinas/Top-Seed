import { computeWinRate, recomputeSessionFromMatches } from "@top-seed/domain";
import type { LeaderboardEntryDto } from "@top-seed/contracts";
import type { LocalCheckIn, LocalMatch, LocalPlayerProfile } from "../db/types.js";

export interface SessionPlayerStats {
  playerProfileId: string;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winRate: number | null;
  sessionSkillRating: number;
  clubRating: number;
}

export function computeSessionPlayerStats(
  sessionId: string,
  matches: LocalMatch[],
  checkIns: LocalCheckIn[],
  playerProfiles: LocalPlayerProfile[],
  ratingMode: "casual" | "rated",
): Map<string, SessionPlayerStats> {
  const profileById = new Map(playerProfiles.map((profile) => [profile.id, profile]));
  const checkInByPlayer = new Map(checkIns.map((checkIn) => [checkIn.playerProfileId, checkIn]));

  const completedMatches = matches
    .filter((match) => match.sessionId === sessionId && match.status === "completed" && match.outcome && match.completedAt)
    .map((match) => ({
      id: match.id,
      completedAt: match.completedAt!,
      outcome: match.outcome as "team_one_win" | "team_two_win" | "draw" | "unscored" | "cancelled",
      winningTeam: match.winningTeam ?? null,
      participants: match.participants.map((participant) => ({
        playerProfileId: participant.playerProfileId,
        team: participant.team,
        ratingBefore: participant.ratingBefore ?? profileById.get(participant.playerProfileId)?.defaultSkillRating ?? 3,
      })),
    }))
    .filter((match) => match.outcome !== "cancelled");

  const initialRatings = new Map(
    playerProfiles.map((profile) => [profile.id, profile.defaultSkillRating]),
  );
  const recompute = recomputeSessionFromMatches(completedMatches, initialRatings, ratingMode);

  const result = new Map<string, SessionPlayerStats>();
  for (const checkIn of checkIns) {
    const stats = recompute.statsByPlayer.get(checkIn.playerProfileId) ?? {
      playerProfileId: checkIn.playerProfileId,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
    const profile = profileById.get(checkIn.playerProfileId);
    result.set(checkIn.playerProfileId, {
      playerProfileId: checkIn.playerProfileId,
      displayName: checkIn.playerDisplayName,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      matchesPlayed: stats.matchesPlayed,
      winRate: computeWinRate(stats.wins, stats.losses, stats.draws),
      sessionSkillRating: checkIn.sessionSkillRating,
      clubRating: recompute.ratingsByPlayer.get(checkIn.playerProfileId) ?? profile?.defaultSkillRating ?? 3,
    });
  }

  for (const [playerProfileId, stats] of recompute.statsByPlayer.entries()) {
    if (result.has(playerProfileId)) {
      continue;
    }
    const profile = profileById.get(playerProfileId);
    const checkIn = checkInByPlayer.get(playerProfileId);
    result.set(playerProfileId, {
      playerProfileId,
      displayName: checkIn?.playerDisplayName ?? profile?.displayName ?? "Player",
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      matchesPlayed: stats.matchesPlayed,
      winRate: computeWinRate(stats.wins, stats.losses, stats.draws),
      sessionSkillRating: checkIn?.sessionSkillRating ?? profile?.defaultSkillRating ?? 3,
      clubRating: recompute.ratingsByPlayer.get(playerProfileId) ?? profile?.defaultSkillRating ?? 3,
    });
  }

  return result;
}

export function statsForCheckIn(
  checkIn: LocalCheckIn,
  statsMap: Map<string, SessionPlayerStats>,
): SessionPlayerStats {
  return (
    statsMap.get(checkIn.playerProfileId) ?? {
      playerProfileId: checkIn.playerProfileId,
      displayName: checkIn.playerDisplayName,
      wins: 0,
      losses: 0,
      draws: 0,
      matchesPlayed: 0,
      winRate: null,
      sessionSkillRating: checkIn.sessionSkillRating,
      clubRating: checkIn.sessionSkillRating,
    }
  );
}
