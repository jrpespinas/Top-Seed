import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { createSessionLocal } from "./createSession.js";
import { checkInPlayerLocal } from "./checkInPlayer.js";
import { updateCheckInLocal } from "./updateCheckIn.js";
import { listPendingOutboxActions } from "../sync/outbox.js";

describe("updateCheckInLocal", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("marks a player resting and enqueues UPDATE_CHECK_IN", async () => {
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

    const updated = await updateCheckInLocal({
      sessionId: "session-1",
      checkInId: "check-in-1",
      queueStatus: "resting",
    });
    expect(updated.queueStatus).toBe("resting");

    const stored = await db.checkIns.get("check-in-1");
    expect(stored?.queueStatus).toBe("resting");

    const pending = await listPendingOutboxActions("session-1");
    expect(pending.some((action) => action.type === "UPDATE_CHECK_IN")).toBe(true);
  });

  it("sets suggestionExcluded for skip suggestions", async () => {
    await createSessionLocal({
      id: "session-2",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
    });
    await checkInPlayerLocal({
      id: "check-in-2",
      sessionId: "session-2",
      playerProfileId: "player-2",
      playerDisplayName: "Bo",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T18:00:00.000Z",
      sessionSkillRating: 3,
      paymentAmountDue: 150,
    });

    const updated = await updateCheckInLocal({
      sessionId: "session-2",
      checkInId: "check-in-2",
      suggestionExcluded: true,
      suggestionExcludeNote: "Let others play first",
    });
    expect(updated.suggestionExcluded).toBe(true);
  });
});
