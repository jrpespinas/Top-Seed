import { validateMarkDoneOrRemoved } from "@top-seed/domain";
import type { UpdateCheckInPayload, CheckInDto } from "@top-seed/contracts";
import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError, assertLiveSession } from "../../shared/application/errors.js";

function toCheckInDto(row: {
  id: string;
  sessionId: string;
  playerProfileId: string;
  playerProfile: { displayName: string };
  arrivalOrder: number;
  checkedInAt: Date;
  queueStatus: string;
  sessionSkillRating: number;
  paymentStatus: string;
  paymentAmountDue: number;
  paymentAmountPaid: number;
  paymentMethod: string;
  paymentNotes: string;
  suggestionExcluded: boolean;
  suggestionExcludeNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CheckInDto {
  return {
    id: row.id,
    sessionId: row.sessionId,
    playerProfileId: row.playerProfileId,
    playerDisplayName: row.playerProfile.displayName,
    arrivalOrder: row.arrivalOrder,
    checkedInAt: row.checkedInAt.toISOString(),
    queueStatus: row.queueStatus as CheckInDto["queueStatus"],
    sessionSkillRating: row.sessionSkillRating,
    paymentStatus: row.paymentStatus as CheckInDto["paymentStatus"],
    paymentAmountDue: row.paymentAmountDue,
    paymentAmountPaid: row.paymentAmountPaid,
    paymentMethod: row.paymentMethod,
    paymentNotes: row.paymentNotes,
    suggestionExcluded: row.suggestionExcluded,
    suggestionExcludeNote: row.suggestionExcludeNote ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateCheckIn(input: {
  checkInId: string;
  sessionId: string;
  payload: UpdateCheckInPayload;
}): Promise<{ checkIn: CheckInDto; serverVersion: number }> {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const existing = await prisma.checkIn.findFirst({
    where: { id: input.checkInId, sessionId: input.sessionId },
    include: { playerProfile: true },
  });
  if (!existing) {
    throw new UseCaseError("VALIDATION_ERROR", "Check-in not found.");
  }

  if (input.payload.queueStatus === "done" || input.payload.queueStatus === "removed") {
    const validation = validateMarkDoneOrRemoved(
      existing.queueStatus as Parameters<typeof validateMarkDoneOrRemoved>[0],
    );
    if (!validation.ok) {
      throw new UseCaseError(validation.code, validation.message);
    }
  }

  const row = await prisma.checkIn.update({
    where: { id: input.checkInId },
    data: {
      queueStatus: input.payload.queueStatus ?? existing.queueStatus,
      sessionSkillRating: input.payload.sessionSkillRating ?? existing.sessionSkillRating,
      suggestionExcluded: input.payload.suggestionExcluded ?? existing.suggestionExcluded,
      suggestionExcludeNote:
        input.payload.suggestionExcludeNote === undefined
          ? existing.suggestionExcludeNote
          : input.payload.suggestionExcludeNote,
      paymentStatus: input.payload.paymentStatus ?? existing.paymentStatus,
      paymentAmountPaid: input.payload.paymentAmountPaid ?? existing.paymentAmountPaid,
      paymentMethod: input.payload.paymentMethod ?? existing.paymentMethod,
      paymentNotes: input.payload.paymentNotes ?? existing.paymentNotes,
    },
    include: { playerProfile: true },
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { checkIn: toCheckInDto(row), serverVersion };
}
