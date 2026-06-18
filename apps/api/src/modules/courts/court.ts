import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError, assertLiveSession } from "../../shared/application/errors.js";

const MAX_COURTS = 8;
const MIN_COURTS = 1;

export interface CreateCourtInput {
  id: string;
  sessionId: string;
  name: string;
  sortOrder: number;
  status?: string;
}

export async function createCourt(input: CreateCourtInput) {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const courtCount = await prisma.court.count({ where: { sessionId: input.sessionId } });
  if (courtCount >= MAX_COURTS) {
    throw new UseCaseError("VALIDATION_ERROR", `A session can have at most ${MAX_COURTS} courts.`);
  }

  const court = await prisma.court.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      sessionId: input.sessionId,
      name: input.name,
      sortOrder: input.sortOrder,
      status: input.status ?? "open",
    },
    update: {
      name: input.name,
      sortOrder: input.sortOrder,
      status: input.status ?? "open",
    },
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { court, serverVersion, serverUpdatedAt: court.updatedAt.toISOString() };
}

async function renumberSessionCourts(sessionId: string) {
  const courts = await prisma.court.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
  });

  for (const [index, court] of courts.entries()) {
    const name = `Court ${index + 1}`;
    const sortOrder = index;
    if (court.name !== name || court.sortOrder !== sortOrder) {
      await prisma.court.update({
        where: { id: court.id },
        data: { name, sortOrder },
      });
    }
  }
}

export interface UpdateCourtInput {
  courtId: string;
  sessionId: string;
  name?: string;
  sortOrder?: number;
  status?: string;
}

export async function updateCourt(input: UpdateCourtInput) {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const existing = await prisma.court.findFirst({
    where: { id: input.courtId, sessionId: input.sessionId },
  });
  if (!existing) {
    const name = input.name ?? `Court ${(input.sortOrder ?? 0) + 1}`;
    const sortOrder = input.sortOrder ?? 0;

    const court = await prisma.court.upsert({
      where: { id: input.courtId },
      create: {
        id: input.courtId,
        sessionId: input.sessionId,
        name,
        sortOrder,
        status: input.status ?? "open",
      },
      update: {
        name,
        sortOrder,
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    const serverVersion = await bumpSessionVersion(input.sessionId);
    return { court, serverVersion, serverUpdatedAt: court.updatedAt.toISOString() };
  }

  const court = await prisma.court.update({
    where: { id: input.courtId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { court, serverVersion, serverUpdatedAt: court.updatedAt.toISOString() };
}

export interface DeleteCourtInput {
  courtId: string;
  sessionId: string;
}

export async function deleteCourt(input: DeleteCourtInput) {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const courtCount = await prisma.court.count({ where: { sessionId: input.sessionId } });
  if (courtCount <= MIN_COURTS) {
    throw new UseCaseError("VALIDATION_ERROR", "At least one court is required.");
  }

  const court = await prisma.court.findFirst({
    where: { id: input.courtId, sessionId: input.sessionId },
  });
  if (!court) {
    const serverVersion = await bumpSessionVersion(input.sessionId);
    return { serverVersion, serverUpdatedAt: new Date().toISOString() };
  }

  const activeMatch = await prisma.match.findFirst({
    where: {
      sessionId: input.sessionId,
      courtId: input.courtId,
      status: { in: ["assigned", "in_progress"] },
    },
  });
  if (activeMatch) {
    throw new UseCaseError(
      "VALIDATION_ERROR",
      "Finish or cancel the match on this court before deleting it.",
    );
  }

  const matchHistoryCount = await prisma.match.count({
    where: { sessionId: input.sessionId, courtId: input.courtId },
  });
  if (matchHistoryCount > 0) {
    throw new UseCaseError(
      "VALIDATION_ERROR",
      "Cannot delete a court that has match history.",
    );
  }

  await prisma.court.delete({ where: { id: input.courtId } });
  await renumberSessionCourts(input.sessionId);

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { serverVersion, serverUpdatedAt: new Date().toISOString() };
}
