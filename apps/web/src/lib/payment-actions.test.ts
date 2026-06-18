import { beforeEach, describe, expect, it } from "vitest";
import { validatePaymentTransition } from "@top-seed/domain";
import { applyPaymentTransition, sortCheckInsForPayments } from "./payment-actions.js";
import type { LocalCheckIn } from "../db/types.js";

const baseCheckIn: LocalCheckIn = {
  id: "check-in-1",
  sessionId: "session-1",
  playerProfileId: "player-1",
  playerDisplayName: "Alex",
  arrivalOrder: 0,
  checkedInAt: "2026-06-09T18:00:00.000Z",
  queueStatus: "waiting",
  sessionSkillRating: 3,
  paymentStatus: "unpaid",
  paymentAmountDue: 150,
  paymentAmountPaid: 0,
  paymentMethod: "none",
  paymentNotes: "",
  syncStatus: "local",
};

describe("payment-actions", () => {
  it("rejects refund from unpaid via domain", () => {
    const result = validatePaymentTransition("unpaid", "mark_refunded");
    expect(result.ok).toBe(false);
  });

  it("marks paid with full amount due", () => {
    const payment = applyPaymentTransition(baseCheckIn, "mark_paid");
    expect(payment.paymentStatus).toBe("paid");
    expect(payment.paymentAmountPaid).toBe(150);
  });

  it("marks refunded from paid", () => {
    const paid = { ...baseCheckIn, paymentStatus: "paid", paymentAmountPaid: 150, paymentMethod: "cash" };
    const payment = applyPaymentTransition(paid, "mark_refunded");
    expect(payment.paymentStatus).toBe("refunded");
  });

  it("marks partial with custom amount", () => {
    const payment = applyPaymentTransition(baseCheckIn, "mark_partial", { partialAmount: 75 });
    expect(payment.paymentStatus).toBe("partial");
    expect(payment.paymentAmountPaid).toBe(75);
  });

  it("sorts unpaid before paid", () => {
    const paid: LocalCheckIn = {
      ...baseCheckIn,
      id: "check-in-2",
      playerDisplayName: "Aaron",
      paymentStatus: "paid",
      paymentAmountPaid: 150,
    };
    const unpaid: LocalCheckIn = { ...baseCheckIn, playerDisplayName: "Zoe" };
    expect(sortCheckInsForPayments(unpaid, paid)).toBeLessThan(0);
  });
});
