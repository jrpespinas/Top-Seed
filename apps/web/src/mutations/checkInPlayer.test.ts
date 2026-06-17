import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { checkInPlayerLocal } from "../mutations/checkInPlayer.js";
import { listPendingOutboxActions } from "../sync/outbox.js";

const SESSION = {
  id: "session-1",
  organizationId: "org-default",
  name: "Open Play",
  venueName: "Courts",
  startsAt: "2026-06-09T09:00:00.000Z",
  status: "active",
  feeAmount: 150,
  currency: "PHP",
  queueMode: "suggested" as const,
  ratingMode: "casual" as const,
};

describe("checkInPlayerLocal", () => {
  beforeEach(async () => {
    await clearDatabase();
    await db.sessions.put(SESSION);
  });

  it("creates a waiting check-in with pending sync status", async () => {
    const checkIn = await checkInPlayerLocal({
      id: "check-in-client-1",
      sessionId: SESSION.id,
      playerProfileId: "player-1",
      playerDisplayName: "Alex Chen",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      sessionSkillRating: 1200,
      paymentAmountDue: 150,
    });

    expect(checkIn.queueStatus).toBe("waiting");
    expect(checkIn.syncStatus).toBe("pending");
    expect(checkIn.paymentAmountPaid).toBe(0);
  });

  it("writes check-in and outbox row in one durable transaction", async () => {
    const actionId = "sync-action-1";
    await checkInPlayerLocal(
      {
        id: "check-in-client-1",
        sessionId: SESSION.id,
        playerProfileId: "player-1",
        playerDisplayName: "Alex Chen",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T10:00:00.000Z",
        sessionSkillRating: 1200,
        paymentAmountDue: 150,
      },
      { syncActionId: actionId },
    );

    const stored = await db.checkIns.get("check-in-client-1");
    const pending = await listPendingOutboxActions(SESSION.id);

    expect(stored?.playerDisplayName).toBe("Alex Chen");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(actionId);
    expect(pending[0]?.type).toBe("CHECK_IN_PLAYER");
    expect(pending[0]?.entityId).toBe("check-in-client-1");
  });

  it("enqueues CHECK_IN_PLAYER payload matching contracts", async () => {
    await checkInPlayerLocal({
      id: "check-in-client-2",
      sessionId: SESSION.id,
      playerProfileId: "player-2",
      playerDisplayName: "Jordan Lee",
      arrivalOrder: 1,
      checkedInAt: "2026-06-09T10:05:00.000Z",
      sessionSkillRating: 1150,
      paymentAmountDue: 150,
    });

    const [action] = await listPendingOutboxActions(SESSION.id);
    expect(action?.payload).toMatchObject({
      sessionId: SESSION.id,
      playerProfileId: "player-2",
      arrivalOrder: 1,
      sessionSkillRating: 1150,
      paymentAmountDue: 150,
      paymentAmountPaid: 0,
      paymentMethod: "none",
    });
  });

  it("throws when session is missing locally", async () => {
    await expect(
      checkInPlayerLocal({
        id: "check-in-missing",
        sessionId: "missing-session",
        playerProfileId: "player-1",
        playerDisplayName: "Nobody",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T10:00:00.000Z",
        sessionSkillRating: 1200,
        paymentAmountDue: 150,
      }),
    ).rejects.toThrow("Session not found");
  });
});
