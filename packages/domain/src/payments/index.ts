import type { DomainResult, PaymentCheckIn, PaymentStatus, PaymentSummary } from "../types/index.js";
import { err, ok } from "../types/index.js";

export interface PaymentInput {
  paymentStatus: PaymentStatus;
  paymentAmountDue: number;
  paymentAmountPaid: number;
}

export function validatePaymentAmounts(input: PaymentInput): DomainResult<PaymentInput> {
  if (input.paymentAmountDue < 0 || input.paymentAmountPaid < 0) {
    return err("PAYMENT_AMOUNT_INVALID", "Check the amount paid.");
  }
  return ok(input);
}

export function validatePaymentState(input: PaymentInput): DomainResult<PaymentInput> {
  const amounts = validatePaymentAmounts(input);
  if (!amounts.ok) {
    return amounts;
  }

  const { paymentStatus, paymentAmountDue, paymentAmountPaid } = input;

  if (paymentStatus === "paid") {
    if (paymentAmountDue > 0 && paymentAmountPaid < paymentAmountDue) {
      return err("PAYMENT_AMOUNT_INVALID", "Paid amount must cover amount due.");
    }
  }

  if (paymentStatus === "partial") {
    if (paymentAmountPaid <= 0 || paymentAmountPaid >= paymentAmountDue) {
      return err("PAYMENT_AMOUNT_INVALID", "Partial payment must be between 0 and amount due.");
    }
  }

  if (paymentStatus === "waived" && paymentAmountPaid < 0) {
    return err("PAYMENT_AMOUNT_INVALID", "Check the amount paid.");
  }

  return ok(input);
}

export type PaymentTransitionAction =
  | "mark_paid"
  | "mark_partial"
  | "mark_waived"
  | "mark_refunded"
  | "reset_to_unpaid";

export function validatePaymentTransition(
  current: PaymentStatus,
  action: PaymentTransitionAction,
): DomainResult<PaymentStatus> {
  switch (action) {
    case "mark_paid":
    case "mark_partial":
    case "mark_waived":
    case "reset_to_unpaid":
      return ok(
        action === "mark_paid"
          ? "paid"
          : action === "mark_partial"
            ? "partial"
            : action === "mark_waived"
              ? "waived"
              : "unpaid",
      );
    case "mark_refunded":
      if (current !== "paid" && current !== "partial") {
        return err(
          "INVALID_PAYMENT_TRANSITION",
          "Refund only applies after paid or partial.",
        );
      }
      return ok("refunded");
    default:
      return err("INVALID_PAYMENT_TRANSITION", "That payment change is not allowed.");
  }
}

export function computePaymentSummary(
  checkIns: PaymentCheckIn[],
  sessionFee: number,
  currency: string,
): PaymentSummary {
  const countsByStatus: Record<PaymentStatus, number> = {
    unpaid: 0,
    partial: 0,
    paid: 0,
    waived: 0,
    refunded: 0,
  };

  let expectedTotal = 0;
  let collectedTotal = 0;
  let unpaidTotal = 0;
  let waivedTotal = 0;
  let refundedTotal = 0;

  for (const checkIn of checkIns) {
    countsByStatus[checkIn.paymentStatus] += 1;
    const due = checkIn.paymentAmountDue > 0 ? checkIn.paymentAmountDue : sessionFee;
    expectedTotal += due;

    switch (checkIn.paymentStatus) {
      case "paid":
        collectedTotal += checkIn.paymentAmountPaid;
        break;
      case "partial":
        collectedTotal += checkIn.paymentAmountPaid;
        unpaidTotal += Math.max(0, due - checkIn.paymentAmountPaid);
        break;
      case "unpaid":
        unpaidTotal += due;
        break;
      case "waived":
        waivedTotal += due;
        break;
      case "refunded":
        refundedTotal += checkIn.paymentAmountPaid;
        break;
    }
  }

  return {
    expectedTotal,
    collectedTotal,
    unpaidTotal,
    waivedTotal,
    refundedTotal,
    countsByStatus,
    currency,
  };
}
