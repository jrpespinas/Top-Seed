import {
  computeMatchRatingDeltas,
  applyRatingDelta,
  resolvePostMatchQueueStatus,
  validateCompleteMatch,
  validateStartMatch,
} from "@top-seed/domain";
import type { MatchResultInput } from "@top-seed/contracts";
import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError } from "../../shared/application/errors.js";

export async function startMatch(input: {
  sessionId: string;
  matchId: string;
  startedAt: string;
}) {
  const match = await prisma.match.findFirst({
    where: { id: input.matchId, sessionId: input.sessionId },
    include: { participants: true },
  });
  if (!match) {
    throw new UseCaseError("VALIDATION_ERROR", "Match not found.");
  }

  const validation = validateStartMatch({
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

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { status: "in_progress", startedAt: new Date(input.startedAt) },
    });
    for (const participant of match.participants) {
      await tx.checkIn.update({
        where: { id: participant.checkInId },
        data: { queueStatus: "playing" },
      });
    }
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { serverVersion };
}

export async function completeMatch(input: {
  sessionId: string;
  matchId: string;
  result: MatchResultInput;
}) {
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

  const validation = validateCompleteMatch({
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

  const queuedMatches = await prisma.queuedMatch.findMany({
    where: { sessionId: input.sessionId, status: { in: ["draft", "ready"] } },
    include: { participants: true },
  });

  const teamOne = match.participants.filter((p) => p.team === "team_one");
  const teamTwo = match.participants.filter((p) => p.team === "team_two");
  const ratingInput = {
    teamOneRatings: teamOne.map((p) => p.ratingBefore),
    teamTwoRatings: teamTwo.map((p) => p.ratingBefore),
  };
  const deltas = computeMatchRatingDeltas(
    session.ratingMode as "casual" | "rated",
    input.result.outcome,
    ratingInput,
    input.result.winningTeam ?? null,
  );

  const endedAt = input.result.endedAt ? new Date(input.result.endedAt) : new Date();

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        status: "completed",
        outcome: input.result.outcome,
        winningTeam: input.result.winningTeam ?? null,
        teamOneScore: input.result.teamOneScore ?? null,
        teamTwoScore: input.result.teamTwoScore ?? null,
        endedAt,
        completedAt: endedAt,
      },
    });

    for (const participant of match.participants) {
      let ratingAfter = participant.ratingBefore;
      let ratingDelta = 0;
      if (deltas) {
        const teamIndex =
          participant.team === "team_one"
            ? teamOne.findIndex((p) => p.id === participant.id)
            : teamTwo.findIndex((p) => p.id === participant.id);
        const delta =
          participant.team === "team_one"
            ? deltas.teamOneDeltas[teamIndex] ?? 0
            : deltas.teamTwoDeltas[teamIndex] ?? 0;
        ratingDelta = delta;
        ratingAfter = applyRatingDelta(participant.ratingBefore, delta);
        if (session.ratingMode === "rated") {
          await tx.playerProfile.update({
            where: { id: participant.playerProfileId },
            data: { defaultSkillRating: ratingAfter },
          });
        }
      }

      await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { ratingAfter, ratingDelta },
      });

      const nextStatus = resolvePostMatchQueueStatus(
        participant.checkInId,
        queuedMatches.map((qm) => ({
          id: qm.id,
          laneId: qm.queueLaneId,
          status: qm.status as "draft" | "ready" | "promoted" | "removed",
          participants: qm.participants.map((p) => ({
            checkInId: p.checkInId,
            playerProfileId: p.playerProfileId,
          })),
        })),
      );

      await tx.checkIn.update({
        where: { id: participant.checkInId },
        data: {
          queueStatus: nextStatus,
          matchesPlayedInSession: { increment: 1 },
          lastMatchEndedAt: endedAt,
        },
      });
    }

    await tx.court.update({
      where: { id: match.courtId },
      data: { status: "open", currentMatchId: null },
    });
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return {
    serverVersion,
    sideEffects: {
      ratingApplied: session.ratingMode === "rated" && deltas !== null,
      leaderboardUpdated: true,
    },
  };
}
