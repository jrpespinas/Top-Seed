import { checkInInitialStatus } from "@top-seed/domain";
import type { CheckInDto } from "@top-seed/contracts";
import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError, assertLiveSession } from "../../shared/application/errors.js";

export interface CheckInPlayerInput {
  id: string;
  sessionId: string;
  playerProfileId: string;
  arrivalOrder: number;
  checkedInAt: string;
  sessionSkillRating: number;
  paymentAmountDue?: number;
  paymentAmountPaid?: number;
  paymentMethod?: string;
  paymentNotes?: string;
}

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

export async function checkInPlayer(input: CheckInPlayerInput): Promise<{
  checkIn: CheckInDto;
  serverVersion: number;
}> {
  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }
  assertLiveSession(session.status);

  const existing = await prisma.checkIn.findUnique({
    where: {
      sessionId_playerProfileId: {
        sessionId: input.sessionId,
        playerProfileId: input.playerProfileId,
      },
    },
  });
  if (existing && existing.queueStatus !== "removed") {
    throw new UseCaseError("VALIDATION_ERROR", "Player is already checked in.");
  }

  const player = await prisma.playerProfile.findUnique({
    where: { id: input.playerProfileId },
  });
  if (!player) {
    throw new UseCaseError("PLAYER_NOT_FOUND", "Player not found.");
  }

  const due = input.paymentAmountDue ?? session.feeAmount;

  const row = await prisma.checkIn.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      sessionId: input.sessionId,
      playerProfileId: input.playerProfileId,
      arrivalOrder: input.arrivalOrder,
      checkedInAt: new Date(input.checkedInAt),
      queueStatus: checkInInitialStatus(),
      sessionSkillRating: input.sessionSkillRating,
      paymentStatus: "unpaid",
      paymentAmountDue: due,
      paymentAmountPaid: input.paymentAmountPaid ?? 0,
      paymentMethod: input.paymentMethod ?? "none",
      paymentNotes: input.paymentNotes ?? "",
    },
    update: {
      arrivalOrder: input.arrivalOrder,
      checkedInAt: new Date(input.checkedInAt),
      queueStatus: checkInInitialStatus(),
      sessionSkillRating: input.sessionSkillRating,
      paymentAmountDue: due,
    },
    include: { playerProfile: true },
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { checkIn: toCheckInDto(row), serverVersion };
}
