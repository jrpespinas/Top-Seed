import {
  clearPlayerFromOtherQueuedMatches,
  queuedMatchStatusForParticipantCount,
} from "@top-seed/domain";
import type { SyncParticipantInput } from "@top-seed/contracts";
import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError, assertLiveSession } from "../../shared/application/errors.js";

export interface CreateQueuedMatchInput {
  id: string;
  sessionId: string;
  queueLaneId: string;
  sortOrder: number;
  createdFrom: "manual" | "suggestion";
  participants: SyncParticipantInput[];
}

export async function createQueuedMatch(input: CreateQueuedMatchInput) {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const lane = await prisma.queueLane.findFirst({
    where: { id: input.queueLaneId, sessionId: input.sessionId },
  });
  if (!lane) {
    throw new UseCaseError("VALIDATION_ERROR", "Queue lane not found.");
  }

  for (const participant of input.participants) {
    const checkIn = await prisma.checkIn.findFirst({
      where: { id: participant.checkInId, sessionId: input.sessionId },
    });
    if (!checkIn) {
      throw new UseCaseError("VALIDATION_ERROR", "Check-in not found.");
    }
    if (checkIn.queueStatus === "playing") {
      throw new UseCaseError("VALIDATION_ERROR", "Player is already on a court match.");
    }
  }

  const status = queuedMatchStatusForParticipantCount(input.participants.length);

  const queuedMatch = await prisma.$transaction(async (tx) => {
    const created = await tx.queuedMatch.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        sessionId: input.sessionId,
        queueLaneId: input.queueLaneId,
        sortOrder: input.sortOrder,
        status,
        createdFrom: input.createdFrom,
        participants: {
          create: input.participants.map((p) => ({
            playerProfileId: p.playerProfileId,
            checkInId: p.checkInId,
            team: p.team,
            slotOrder: p.slotOrder,
          })),
        },
      },
      update: {
        queueLaneId: input.queueLaneId,
        sortOrder: input.sortOrder,
        status,
        createdFrom: input.createdFrom,
      },
      include: { participants: true },
    });

    for (const participant of input.participants) {
      await tx.checkIn.update({
        where: { id: participant.checkInId },
        data: { queueStatus: "assigned" },
      });
    }

    return created;
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { queuedMatch, serverVersion };
}

export interface PromoteQueuedMatchInput {
  queuedMatchId: string;
  sessionId: string;
  courtId: string;
  matchId: string;
  assignedAt: string;
}

export async function promoteQueuedMatchToCourt(input: PromoteQueuedMatchInput) {
  const queuedMatch = await prisma.queuedMatch.findFirst({
    where: { id: input.queuedMatchId, sessionId: input.sessionId },
    include: { participants: true },
  });
  if (!queuedMatch) {
    throw new UseCaseError("VALIDATION_ERROR", "Queued match not found.");
  }

  const court = await prisma.court.findFirst({
    where: { id: input.courtId, sessionId: input.sessionId },
  });
  if (!court) {
    throw new UseCaseError("COURT_NOT_OPEN", "Court not found.");
  }

  const { validatePromoteQueuedMatch } = await import("@top-seed/domain");
  const validation = validatePromoteQueuedMatch(
    {
      id: queuedMatch.id,
      laneId: queuedMatch.queueLaneId,
      status: queuedMatch.status as "draft" | "ready" | "promoted" | "removed",
      participants: queuedMatch.participants.map((p) => ({
        checkInId: p.checkInId,
        playerProfileId: p.playerProfileId,
      })),
    },
    {
      id: court.id,
      status: court.status as "open" | "occupied" | "paused" | "unavailable",
      currentMatchId: court.currentMatchId,
    },
  );
  if (!validation.ok) {
    throw new UseCaseError(validation.code, validation.message);
  }

  const allQueued = await prisma.queuedMatch.findMany({
    where: { sessionId: input.sessionId },
    include: { participants: true },
  });

  const participantCheckInIds = queuedMatch.participants.map((p) => p.checkInId);
  const cleared = clearPlayerFromOtherQueuedMatches(
    queuedMatch.id,
    participantCheckInIds,
    allQueued.map((qm) => ({
      id: qm.id,
      laneId: qm.queueLaneId,
      status: qm.status as "draft" | "ready" | "promoted" | "removed",
      participants: qm.participants.map((p) => ({
        checkInId: p.checkInId,
        playerProfileId: p.playerProfileId,
      })),
    })),
  );

  const result = await prisma.$transaction(async (tx) => {
    for (const qm of cleared) {
      if (qm.id === queuedMatch.id) {
        continue;
      }
      const original = allQueued.find((x) => x.id === qm.id);
      await tx.queuedMatchParticipant.deleteMany({ where: { queuedMatchId: qm.id } });
      for (const p of qm.participants) {
        const originalParticipant = original?.participants.find((x) => x.checkInId === p.checkInId);
        await tx.queuedMatchParticipant.create({
          data: {
            queuedMatchId: qm.id,
            checkInId: p.checkInId,
            playerProfileId: p.playerProfileId,
            team: originalParticipant?.team ?? "team_one",
            slotOrder: originalParticipant?.slotOrder ?? 1,
          },
        });
      }
      await tx.queuedMatch.update({
        where: { id: qm.id },
        data: { status: qm.status },
      });
    }

    const checkInRows = await tx.checkIn.findMany({
      where: { id: { in: queuedMatch.participants.map((p) => p.checkInId) } },
    });
    const ratingByCheckIn = new Map(checkInRows.map((c) => [c.id, c.sessionSkillRating]));

    const match = await tx.match.create({
      data: {
        id: input.matchId,
        sessionId: input.sessionId,
        courtId: input.courtId,
        status: "assigned",
        participants: {
          create: queuedMatch.participants.map((p) => ({
            playerProfileId: p.playerProfileId,
            checkInId: p.checkInId,
            team: p.team,
            ratingBefore: ratingByCheckIn.get(p.checkInId) ?? 3,
          })),
        },
      },
      include: { participants: true },
    });

    await tx.queuedMatch.update({
      where: { id: queuedMatch.id },
      data: { status: "promoted" },
    });

    await tx.court.update({
      where: { id: input.courtId },
      data: { status: "occupied", currentMatchId: input.matchId },
    });

    return match;
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { match: result, serverVersion };
}
