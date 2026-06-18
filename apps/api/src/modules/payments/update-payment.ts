import type { UpdatePaymentPayload, CheckInDto } from "@top-seed/contracts";
import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError } from "../../shared/application/errors.js";

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

function paymentFieldsMatch(
  row: {
    paymentStatus: string;
    paymentAmountDue: number;
    paymentAmountPaid: number;
    paymentMethod: string;
    paymentNotes: string;
  },
  payload: UpdatePaymentPayload,
): boolean {
  return (
    row.paymentStatus === payload.paymentStatus &&
    row.paymentAmountDue === payload.paymentAmountDue &&
    row.paymentAmountPaid === payload.paymentAmountPaid &&
    row.paymentMethod === payload.paymentMethod &&
    row.paymentNotes === payload.paymentNotes
  );
}

export async function updatePayment(input: {
  checkInId: string;
  sessionId: string;
  payload: UpdatePaymentPayload;
}): Promise<{ checkIn: CheckInDto; serverVersion: number; alreadyApplied?: boolean }> {
  const checkIn = await prisma.checkIn.findFirst({
    where: { id: input.checkInId, sessionId: input.sessionId },
    include: { playerProfile: true },
  });
  if (!checkIn) {
    throw new UseCaseError("VALIDATION_ERROR", "Check-in not found.");
  }

  if (paymentFieldsMatch(checkIn, input.payload)) {
    const serverVersion = await prisma.session.findUnique({
      where: { id: input.sessionId },
      select: { serverVersion: true },
    });
    return {
      checkIn: toCheckInDto(checkIn),
      serverVersion: serverVersion?.serverVersion ?? 0,
      alreadyApplied: true,
    };
  }

  const row = await prisma.checkIn.update({
    where: { id: input.checkInId },
    data: {
      paymentStatus: input.payload.paymentStatus,
      paymentAmountDue: input.payload.paymentAmountDue,
      paymentAmountPaid: input.payload.paymentAmountPaid,
      paymentMethod: input.payload.paymentMethod,
      paymentNotes: input.payload.paymentNotes,
    },
    include: { playerProfile: true },
  });

  const serverVersion = await bumpSessionVersion(input.sessionId);
  return { checkIn: toCheckInDto(row), serverVersion };
}
