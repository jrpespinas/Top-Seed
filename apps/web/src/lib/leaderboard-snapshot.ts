import { computeWinRate, recomputeSessionFromMatches } from "@top-seed/domain";
import type { LeaderboardEntryDto } from "@top-seed/contracts";
import type { LocalCheckIn, LocalMatch, LocalPlayerProfile, LocalSession } from "../db/types.js";

export type LeaderboardScope = "session" | "club";
export type LeaderboardSortKey =
  | "rating"
  | "wins"
  | "losses"
  | "draws"
  | "games"
  | "winRate"
  | "sessions";

function buildCompletedRecords(
  matches: LocalMatch[],
  profiles: Map<string, LocalPlayerProfile>,
): Parameters<typeof recomputeSessionFromMatches>[0] {
  return matches
    .filter((match) => match.status === "completed" && match.outcome && match.completedAt)
    .map((match) => ({
      id: match.id,
      completedAt: match.completedAt!,
      outcome: match.outcome as "team_one_win" | "team_two_win" | "draw" | "unscored" | "cancelled",
      winningTeam: match.winningTeam ?? null,
      participants: match.participants.map((participant) => ({
        playerProfileId: participant.playerProfileId,
        team: participant.team,
        ratingBefore:
          participant.ratingBefore ?? profiles.get(participant.playerProfileId)?.defaultSkillRating ?? 3,
      })),
    }))
    .filter((match) => match.outcome !== "cancelled");
}

export function buildSessionLeaderboardEntries(
  session: LocalSession,
  matches: LocalMatch[],
  checkIns: LocalCheckIn[],
  playerProfiles: LocalPlayerProfile[],
): LeaderboardEntryDto[] {
  const profileById = new Map(playerProfiles.map((profile) => [profile.id, profile]));
  const completed = buildCompletedRecords(
    matches.filter((match) => match.sessionId === session.id),
    profileById,
  );
  const initialRatings = new Map(
    playerProfiles.map((profile) => [profile.id, profile.defaultSkillRating]),
  );
  const recompute = recomputeSessionFromMatches(completed, initialRatings, session.ratingMode);

  const attendanceByPlayer = new Map<string, number>();
  for (const checkIn of checkIns) {
    attendanceByPlayer.set(checkIn.playerProfileId, (attendanceByPlayer.get(checkIn.playerProfileId) ?? 0) + 1);
  }

  const playerIds = new Set<string>([
    ...checkIns.map((checkIn) => checkIn.playerProfileId),
    ...completed.flatMap((match) => match.participants.map((participant) => participant.playerProfileId)),
  ]);

  const entries: LeaderboardEntryDto[] = [...playerIds].map((playerProfileId) => {
    const stats = recompute.statsByPlayer.get(playerProfileId) ?? {
      playerProfileId,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
    const profile = profileById.get(playerProfileId);
    const checkIn = checkIns.find((row) => row.playerProfileId === playerProfileId);
    return {
      playerProfileId,
      displayName: checkIn?.playerDisplayName ?? profile?.displayName ?? "Player",
      currentRating: recompute.ratingsByPlayer.get(playerProfileId) ?? profile?.defaultSkillRating ?? 3,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      winRate: computeWinRate(stats.wins, stats.losses, stats.draws),
      attendanceCount: attendanceByPlayer.get(playerProfileId) ?? (checkIn ? 1 : 0),
    };
  });

  return rankLeaderboardEntries(entries);
}

export function buildClubLeaderboardEntries(
  sessions: LocalSession[],
  matches: LocalMatch[],
  checkIns: LocalCheckIn[],
  playerProfiles: LocalPlayerProfile[],
): LeaderboardEntryDto[] {
  const profileById = new Map(playerProfiles.map((profile) => [profile.id, profile]));
  const completed = buildCompletedRecords(matches, profileById);
  const initialRatings = new Map(
    playerProfiles.map((profile) => [profile.id, profile.defaultSkillRating]),
  );

  const statsByPlayer = new Map<
    string,
    { wins: number; losses: number; draws: number; matchesPlayed: number }
  >();
  const ratingsByPlayer = new Map(initialRatings);
  const sessionsByPlayer = new Map<string, Set<string>>();

  for (const session of sessions) {
    const sessionMatches = completed.filter((match) =>
      matches.find((row) => row.id === match.id && row.sessionId === session.id),
    );
    const recompute = recomputeSessionFromMatches(sessionMatches, ratingsByPlayer, session.ratingMode);
    for (const [playerProfileId, stats] of recompute.statsByPlayer.entries()) {
      const current = statsByPlayer.get(playerProfileId) ?? {
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
      };
      statsByPlayer.set(playerProfileId, {
        wins: current.wins + stats.wins,
        losses: current.losses + stats.losses,
        draws: current.draws + stats.draws,
        matchesPlayed: current.matchesPlayed + stats.matchesPlayed,
      });
      for (const [playerId, rating] of recompute.ratingsByPlayer.entries()) {
        ratingsByPlayer.set(playerId, rating);
      }
      for (const participant of sessionMatches.flatMap((match) => match.participants)) {
        if (!sessionsByPlayer.has(participant.playerProfileId)) {
          sessionsByPlayer.set(participant.playerProfileId, new Set());
        }
        sessionsByPlayer.get(participant.playerProfileId)!.add(session.id);
      }
    }
  }

  const attendanceByPlayer = new Map<string, number>();
  for (const checkIn of checkIns) {
    attendanceByPlayer.set(checkIn.playerProfileId, (attendanceByPlayer.get(checkIn.playerProfileId) ?? 0) + 1);
  }

  const playerIds = new Set<string>([
    ...playerProfiles.map((profile) => profile.id),
    ...statsByPlayer.keys(),
  ]);

  const entries: LeaderboardEntryDto[] = [...playerIds].map((playerProfileId) => {
    const stats = statsByPlayer.get(playerProfileId) ?? {
      wins: 0,
      losses: 0,
      draws: 0,
      matchesPlayed: 0,
    };
    const profile = profileById.get(playerProfileId);
    return {
      playerProfileId,
      displayName: profile?.displayName ?? "Player",
      currentRating: ratingsByPlayer.get(playerProfileId) ?? profile?.defaultSkillRating ?? 3,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      winRate: computeWinRate(stats.wins, stats.losses, stats.draws),
      attendanceCount: attendanceByPlayer.get(playerProfileId) ?? 0,
    };
  });

  return rankLeaderboardEntries(
    entries.map((entry) => ({
      ...entry,
      attendanceCount: sessionsByPlayer.get(entry.playerProfileId)?.size ?? entry.attendanceCount,
    })),
  );
}

export function sortLeaderboardEntries(
  entries: LeaderboardEntryDto[],
  sortKey: LeaderboardSortKey,
  direction: "asc" | "desc" = "desc",
): LeaderboardEntryDto[] {
  const sorted = [...entries].sort((a, b) => {
    const value = (entry: LeaderboardEntryDto): number => {
      switch (sortKey) {
        case "rating":
          return entry.currentRating;
        case "wins":
          return entry.wins;
        case "losses":
          return entry.losses;
        case "draws":
          return entry.draws;
        case "games":
          return entry.matchesPlayed;
        case "winRate":
          return entry.winRate ?? -1;
        case "sessions":
          return entry.attendanceCount;
        default:
          return 0;
      }
    };
    const diff = value(a) - value(b);
    if (diff !== 0) {
      return direction === "desc" ? -diff : diff;
    }
    return a.displayName.localeCompare(b.displayName);
  });
  return rankLeaderboardEntries(sorted);
}

function rankLeaderboardEntries(entries: LeaderboardEntryDto[]): LeaderboardEntryDto[] {
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}
