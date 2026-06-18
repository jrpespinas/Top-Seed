import { recomputeSessionFromMatches, validateCorrectMatchResult } from "@top-seed/domain";
import type { UpdateMatchResultPayload } from "@top-seed/contracts";
import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError } from "../../shared/application/errors.js";

export async function updateMatchResult(input: {
  sessionId: string;
  matchId: string;
  result: UpdateMatchResultPayload;
}): Promise<{
  serverVersion: number;
  sideEffects: { ratingApplied: boolean; leaderboardUpdated: boolean };
}> {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }

  const match = await prisma.match.findFirst({
    where: { id: input.matchId, sessionId: input.sessionId },
    include: { participants: true },
  });
  if (!match) {
    throw new UseCaseError("VALIDATION_ERROR", "Match not found.");
  }

  const validation = validateCorrectMatchResult({
    id: match.id,
    courtId: match.courtId,
    status: match.status as "assigned" | "in_progress" | "completed" | "cancelled",
    outcome: match.outcome as "team_one_win" | "team_two_win" | "draw" | "unscored" | "cancelled" | null,
    winningTeam: match.winningTeam as "team_one" | "team_two" | null,
    startedAt: match.startedAt?.toISOString() ?? null,
    endedAt: match.endedAt?.toISOString() ?? null,
    completedAt: match.completedAt?.toISOString() ?? null,
    participants: match.participants.map((p) => ({
      checkInId: p.checkInId,
      playerProfileId: p.playerProfileId,
      team: p.team as "team_one" | "team_two",
    })),
  });
  if (!validation.ok) {
    throw new UseCaseError(validation.code, validation.message);
  }

  if (
    (input.result.outcome === "team_one_win" || input.result.outcome === "team_two_win") &&
    !input.result.winningTeam
  ) {
    throw new UseCaseError("INVALID_MATCH_OUTCOME", "Result does not match the scores.");
  }

  const endedAt = input.result.endedAt ? new Date(input.result.endedAt) : match.endedAt ?? new Date();

  await prisma.match.update({
    where: { id: match.id },
    data: {
      outcome: input.result.outcome,
      winningTeam: input.result.winningTeam ?? null,
      teamOneScore: input.result.teamOneScore ?? null,
      teamTwoScore: input.result.teamTwoScore ?? null,
      endedAt,
      completedAt: endedAt,
    },
  });

  const allMatches = await prisma.match.findMany({
    where: { sessionId: input.sessionId, status: "completed" },
    include: { participants: true },
  });

  const profiles = await prisma.playerProfile.findMany({
    where: { organizationId: session.organizationId },
  });
  const initialRatings = new Map(profiles.map((p) => [p.id, p.defaultSkillRating]));

  const completedRecords = allMatches
    .filter((row) => row.outcome && row.completedAt && row.outcome !== "cancelled")
    .map((row) => ({
      id: row.id,
      completedAt: row.completedAt!.toISOString(),
      outcome: row.outcome as "team_one_win" | "team_two_win" | "draw" | "unscored" | "cancelled",
      winningTeam: row.winningTeam as "team_one" | "team_two" | null,
      participants: row.participants.map((participant) => ({
        playerProfileId: participant.playerProfileId,
        team: participant.team as "team_one" | "team_two",
        ratingBefore: participant.ratingBefore,
      })),
    }));

  const recompute = recomputeSessionFromMatches(
    completedRecords,
    initialRatings,
    session.ratingMode as "casual" | "rated",
  );

  await prisma.$transaction(async (tx) => {
    for (const row of allMatches) {
      const deltas = recompute.matchDeltas.get(row.id);
      if (!deltas) {
        continue;
      }
      for (const participant of row.participants) {
        const delta = deltas.get(participant.playerProfileId) ?? 0;
        const ratingBefore = participant.ratingBefore;
        const ratingAfter =
          recompute.ratingsByPlayer.get(participant.playerProfileId) ?? ratingBefore;
        await tx.matchParticipant.update({
          where: { id: participant.id },
          data: { ratingDelta: delta, ratingAfter },
        });
      }
    }

    if (session.ratingMode === "rated") {
      for (const [playerProfileId, rating] of recompute.ratingsByPlayer.entries()) {
        await tx.playerProfile.update({
          where: { id: playerProfileId },
          data: { defaultSkillRating: rating },
        });
        await tx.checkIn.updateMany({
          where: { sessionId: input.sessionId, playerProfileId },
          data: { sessionSkillRating: rating },
        });
      }
    }
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return {
    serverVersion,
    sideEffects: {
      ratingApplied: session.ratingMode === "rated",
      leaderboardUpdated: true,
    },
  };
}
