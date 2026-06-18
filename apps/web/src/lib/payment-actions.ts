import type { PaymentStatus } from "@top-seed/domain";
import {
  validatePaymentState,
  validatePaymentTransition,
  type PaymentTransitionAction,
} from "@top-seed/domain";
import type { LocalCheckIn } from "../db/types.js";

export interface PaymentFields {
  paymentStatus: PaymentStatus;
  paymentAmountDue: number;
  paymentAmountPaid: number;
  paymentMethod: string;
  paymentNotes: string;
}

export function applyPaymentTransition(
  checkIn: LocalCheckIn,
  action: PaymentTransitionAction,
  options?: { partialAmount?: number; method?: string; notes?: string },
): PaymentFields {
  const transition = validatePaymentTransition(
    checkIn.paymentStatus as PaymentStatus,
    action,
  );
  if (!transition.ok) {
    throw new Error(transition.message);
  }

  const nextStatus = transition.value;
  let paymentAmountPaid = checkIn.paymentAmountPaid;
  let paymentMethod = options?.method ?? checkIn.paymentMethod ?? "cash";
  let paymentNotes = options?.notes ?? checkIn.paymentNotes;

  switch (action) {
    case "mark_paid":
      paymentAmountPaid = checkIn.paymentAmountDue;
      paymentMethod = options?.method ?? "cash";
      break;
    case "mark_partial":
      paymentAmountPaid = options?.partialAmount ?? Math.floor(checkIn.paymentAmountDue / 2);
      break;
    case "mark_waived":
      paymentAmountPaid = 0;
      break;
    case "mark_refunded":
      paymentNotes = options?.notes ?? (paymentNotes || "Refunded outside app");
      break;
    case "reset_to_unpaid":
      paymentAmountPaid = 0;
      paymentMethod = "none";
      paymentNotes = "";
      break;
  }

  const validated = validatePaymentState({
    paymentStatus: nextStatus,
    paymentAmountDue: checkIn.paymentAmountDue,
    paymentAmountPaid,
  });
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  return {
    paymentStatus: nextStatus,
    paymentAmountDue: checkIn.paymentAmountDue,
    paymentAmountPaid,
    paymentMethod,
    paymentNotes,
  };
}

export const PAYMENT_STATUS_ORDER: Record<PaymentStatus, number> = {
  unpaid: 0,
  partial: 1,
  paid: 2,
  waived: 3,
  refunded: 4,
};

export function sortCheckInsForPayments(a: LocalCheckIn, b: LocalCheckIn): number {
  const statusDiff =
    PAYMENT_STATUS_ORDER[a.paymentStatus as PaymentStatus] -
    PAYMENT_STATUS_ORDER[b.paymentStatus as PaymentStatus];
  if (statusDiff !== 0) {
    return statusDiff;
  }
  return a.playerDisplayName.localeCompare(b.playerDisplayName);
}
