import { applyPaymentTransition } from "../lib/payment-actions.js";
import { updatePaymentLocal } from "./updatePayment.js";
import type { PaymentTransitionAction } from "@top-seed/domain";
import { db } from "../db/database.js";

export async function recordPaymentLocal(input: {
  sessionId: string;
  checkInId: string;
  paymentStatus: "paid" | "partial" | "waived" | "refunded" | "unpaid";
  paymentAmountPaid?: number;
  paymentMethod?: string;
}) {
  const checkIn = await db.checkIns.get(input.checkInId);
  if (!checkIn) {
    throw new Error("Check-in not found.");
  }

  const actionMap: Record<string, PaymentTransitionAction> = {
    paid: "mark_paid",
    partial: "mark_partial",
    waived: "mark_waived",
    refunded: "mark_refunded",
    unpaid: "reset_to_unpaid",
  };

  const action = actionMap[input.paymentStatus];
  if (!action) {
    throw new Error("Unsupported payment status.");
  }

  const payment = applyPaymentTransition(checkIn, action, {
    partialAmount: input.paymentAmountPaid,
    method: input.paymentMethod,
  });

  if (input.paymentAmountPaid !== undefined && input.paymentStatus === "partial") {
    payment.paymentAmountPaid = input.paymentAmountPaid;
  }

  return updatePaymentLocal({
    sessionId: input.sessionId,
    checkInId: input.checkInId,
    payment,
  });
}
