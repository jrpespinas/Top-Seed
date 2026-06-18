import { validateDeleteQueueLane } from "@top-seed/domain";
import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError, assertLiveSession } from "../../shared/application/errors.js";

function normalizeLaneStatus(status?: string): string {
  if (status === "deleted") {
    return "deleted";
  }
  if (status === "open" || status === "active") {
    return "active";
  }
  return status ?? "active";
}

export interface CreateQueueLaneInput {
  id: string;
  sessionId: string;
  name: string;
  sortOrder: number;
}

export async function createQueueLane(input: CreateQueueLaneInput) {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const lane = await prisma.queueLane.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      sessionId: input.sessionId,
      name: input.name,
      sortOrder: input.sortOrder,
      status: "active",
    },
    update: {
      name: input.name,
      sortOrder: input.sortOrder,
      status: "active",
    },
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { lane, serverVersion, serverUpdatedAt: lane.updatedAt.toISOString() };
}

export interface UpdateQueueLaneInput {
  laneId: string;
  sessionId: string;
  name?: string;
  sortOrder?: number;
  status?: string;
}

export async function updateQueueLane(input: UpdateQueueLaneInput) {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const existing = await prisma.queueLane.findFirst({
    where: { id: input.laneId, sessionId: input.sessionId },
  });
  if (!existing) {
    const name = input.name ?? "Queue";
    const sortOrder = input.sortOrder ?? 0;

    const lane = await prisma.queueLane.upsert({
      where: { id: input.laneId },
      create: {
        id: input.laneId,
        sessionId: input.sessionId,
        name,
        sortOrder,
        status: normalizeLaneStatus(input.status),
      },
      update: {
        name,
        sortOrder,
        ...(input.status !== undefined ? { status: normalizeLaneStatus(input.status) } : {}),
      },
    });
    const serverVersion = await bumpSessionVersion(input.sessionId);
    return { lane, serverVersion, serverUpdatedAt: lane.updatedAt.toISOString() };
  }

  const lane = await prisma.queueLane.update({
    where: { id: input.laneId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.status !== undefined ? { status: normalizeLaneStatus(input.status) } : {}),
    },
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { lane, serverVersion, serverUpdatedAt: lane.updatedAt.toISOString() };
}

export interface DeleteQueueLaneInput {
  laneId: string;
  sessionId: string;
  deleteQueuedMatches?: boolean;
}

export async function deleteQueueLane(input: DeleteQueueLaneInput) {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const lanes = await prisma.queueLane.findMany({
    where: { sessionId: input.sessionId, status: { not: "deleted" } },
  });
  const validation = validateDeleteQueueLane(
    lanes.map((lane) => ({ id: lane.id, isActive: lane.status !== "deleted" })),
    input.laneId,
  );
  if (!validation.ok) {
    throw new UseCaseError("VALIDATION_ERROR", validation.message);
  }

  const lane = await prisma.queueLane.findFirst({
    where: { id: input.laneId, sessionId: input.sessionId },
  });
  if (!lane) {
    const serverVersion = await bumpSessionVersion(input.sessionId);
    return { serverVersion, serverUpdatedAt: new Date().toISOString() };
  }

  await prisma.$transaction(async (tx) => {
    if (input.deleteQueuedMatches) {
      const staged = await tx.queuedMatch.findMany({
        where: {
          sessionId: input.sessionId,
          queueLaneId: input.laneId,
          status: { in: ["draft", "ready"] },
        },
        include: { participants: true },
      });

      for (const queuedMatch of staged) {
        for (const participant of queuedMatch.participants) {
          const stillStaged = await tx.queuedMatch.count({
            where: {
              sessionId: input.sessionId,
              id: { not: queuedMatch.id },
              status: { in: ["draft", "ready"] },
              participants: { some: { checkInId: participant.checkInId } },
            },
          });
          if (stillStaged === 0) {
            await tx.checkIn.update({
              where: { id: participant.checkInId },
              data: { queueStatus: "waiting" },
            });
          }
        }
        await tx.queuedMatch.update({
          where: { id: queuedMatch.id },
          data: { status: "removed", participants: { deleteMany: {} } },
        });
      }
    }

    await tx.queueLane.update({
      where: { id: input.laneId },
      data: { status: "deleted" },
    });
  });

  const updated = await prisma.queueLane.findUniqueOrThrow({ where: { id: input.laneId } });
  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { lane: updated, serverVersion, serverUpdatedAt: updated.updatedAt.toISOString() };
}

export interface ReorderQueueLanesInput {
  sessionId: string;
  orderedLaneIds: string[];
}

export async function reorderQueueLanes(input: ReorderQueueLanesInput) {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const lanes = await prisma.queueLane.findMany({
    where: { sessionId: input.sessionId, id: { in: input.orderedLaneIds } },
  });
  if (lanes.length !== input.orderedLaneIds.length) {
    throw new UseCaseError("VALIDATION_ERROR", "One or more queue lanes were not found.");
  }

  await prisma.$transaction(
    input.orderedLaneIds.map((laneId, index) =>
      prisma.queueLane.update({
        where: { id: laneId },
        data: { sortOrder: index },
      }),
    ),
  );

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return {
    serverVersion,
    serverUpdatedAt: new Date().toISOString(),
  };
}
