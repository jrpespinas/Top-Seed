import { updateCheckInLocal } from "./updateCheckIn.js";

export async function recordPaymentLocal(input: {
  sessionId: string;
  checkInId: string;
  paymentStatus: "paid" | "partial" | "waived" | "refunded" | "unpaid";
  paymentAmountPaid?: number;
  paymentMethod?: string;
}) {
  return updateCheckInLocal({
    sessionId: input.sessionId,
    checkInId: input.checkInId,
    paymentStatus: input.paymentStatus,
    paymentAmountPaid: input.paymentAmountPaid,
    paymentMethod: input.paymentMethod ?? "cash",
  });
}
