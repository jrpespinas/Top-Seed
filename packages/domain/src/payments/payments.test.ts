import { describe, expect, it } from "vitest";
import {
  computePaymentSummary,
  validatePaymentState,
  validatePaymentTransition,
} from "./index.js";

describe("validatePaymentState", () => {
  it("rejects negative amounts", () => {
    const result = validatePaymentState({
      paymentStatus: "partial",
      paymentAmountDue: 250,
      paymentAmountPaid: -1,
    });
    expect(result.ok).toBe(false);
  });

  it("paid requires full amount", () => {
    const result = validatePaymentState({
      paymentStatus: "paid",
      paymentAmountDue: 250,
      paymentAmountPaid: 100,
    });
    expect(result.ok).toBe(false);
  });

  it("partial requires between zero and due", () => {
    const valid = validatePaymentState({
      paymentStatus: "partial",
      paymentAmountDue: 250,
      paymentAmountPaid: 100,
    });
    expect(valid.ok).toBe(true);

    const invalid = validatePaymentState({
      paymentStatus: "partial",
      paymentAmountDue: 250,
      paymentAmountPaid: 250,
    });
    expect(invalid.ok).toBe(false);
  });
});

describe("validatePaymentTransition", () => {
  it("allows reset to unpaid", () => {
    const result = validatePaymentTransition("paid", "reset_to_unpaid");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("unpaid");
    }
  });

  it("refund only after paid or partial", () => {
    const invalid = validatePaymentTransition("unpaid", "mark_refunded");
    expect(invalid.ok).toBe(false);

    const valid = validatePaymentTransition("paid", "mark_refunded");
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.value).toBe("refunded");
    }
  });
});

describe("computePaymentSummary", () => {
  it("computes collected, unpaid, waived, and refunded totals", () => {
    const summary = computePaymentSummary(
      [
        { id: "c1", paymentStatus: "paid", paymentAmountDue: 250, paymentAmountPaid: 250 },
        { id: "c2", paymentStatus: "partial", paymentAmountDue: 250, paymentAmountPaid: 100 },
        { id: "c3", paymentStatus: "unpaid", paymentAmountDue: 250, paymentAmountPaid: 0 },
        { id: "c4", paymentStatus: "waived", paymentAmountDue: 250, paymentAmountPaid: 0 },
        { id: "c5", paymentStatus: "refunded", paymentAmountDue: 250, paymentAmountPaid: 250 },
      ],
      250,
      "PHP",
    );

    expect(summary.expectedTotal).toBe(1250);
    expect(summary.collectedTotal).toBe(350);
    expect(summary.unpaidTotal).toBe(250 + 150);
    expect(summary.waivedTotal).toBe(250);
    expect(summary.refundedTotal).toBe(250);
    expect(summary.countsByStatus.paid).toBe(1);
    expect(summary.countsByStatus.refunded).toBe(1);
    expect(summary.currency).toBe("PHP");
  });
});
