import { beforeEach, describe, expect, it } from "vitest";
import { computePaymentSummary, type PaymentCheckIn } from "@top-seed/domain";
import { clearDatabase, db } from "../db/database.js";
import { createSessionLocal } from "./createSession.js";
import { checkInPlayerLocal } from "./checkInPlayer.js";
import { updatePaymentLocal } from "./updatePayment.js";
import { applyPaymentTransition } from "../lib/payment-actions.js";
import { listPendingOutboxActions } from "../sync/outbox.js";

describe("updatePaymentLocal", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  async function seedCheckIn() {
    await createSessionLocal({
      id: "session-1",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
    });
    await checkInPlayerLocal({
      id: "check-in-1",
      sessionId: "session-1",
      playerProfileId: "player-1",
      playerDisplayName: "Alex",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T18:00:00.000Z",
      sessionSkillRating: 3,
      paymentAmountDue: 150,
    });
  }

  it("marks paid and enqueues UPDATE_PAYMENT", async () => {
    await seedCheckIn();
    const checkIn = (await db.checkIns.get("check-in-1"))!;
    const payment = applyPaymentTransition(checkIn, "mark_paid");

    await updatePaymentLocal(
      { sessionId: "session-1", checkInId: "check-in-1", payment },
      { syncActionId: "sync-payment-1" },
    );

    const stored = await db.checkIns.get("check-in-1");
    expect(stored?.paymentStatus).toBe("paid");
    expect(stored?.syncStatus).toBe("pending");

    const outbox = await listPendingOutboxActions("session-1");
    const paymentAction = outbox.find((action) => action.type === "UPDATE_PAYMENT");
    expect(paymentAction).toBeDefined();
    expect(paymentAction?.payload).toMatchObject({ paymentStatus: "paid", paymentAmountPaid: 150 });
  });

  it("updates payment summary totals after mark paid and refund", async () => {
    await seedCheckIn();
    const checkIn = (await db.checkIns.get("check-in-1"))!;
    await updatePaymentLocal({
      sessionId: "session-1",
      checkInId: "check-in-1",
      payment: applyPaymentTransition(checkIn, "mark_paid"),
    });

    let summary = computePaymentSummary((await db.checkIns.toArray()) as PaymentCheckIn[], 150, "PHP");
    expect(summary.collectedTotal).toBe(150);

    const paid = (await db.checkIns.get("check-in-1"))!;
    await updatePaymentLocal({
      sessionId: "session-1",
      checkInId: "check-in-1",
      payment: applyPaymentTransition(paid, "mark_refunded"),
    });

    summary = computePaymentSummary((await db.checkIns.toArray()) as PaymentCheckIn[], 150, "PHP");
    expect(summary.refundedTotal).toBe(150);
    expect(summary.collectedTotal).toBe(0);
  });
});
