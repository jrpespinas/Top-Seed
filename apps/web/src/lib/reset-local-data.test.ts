import { describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { resetAllLocalData } from "./reset-local-data.js";

describe("resetAllLocalData", () => {
  it("clears sessions, players, and sync outbox", async () => {
    await db.sessions.put({
      id: "session-1",
      organizationId: "org-default",
      name: "Test",
      venueName: "Gym",
      startsAt: "2026-06-09T10:00:00.000Z",
      status: "active",
      feeAmount: 100,
      currency: "PHP",
      queueMode: "suggested",
      ratingMode: "casual",
    });
    await db.syncOutbox.put({
      id: "action-1",
      organizationId: "org-default",
      type: "CHECK_IN_PLAYER",
      entityType: "checkIn",
      entityId: "check-in-1",
      sessionId: "session-1",
      payload: {},
      createdAt: "2026-06-09T10:00:00.000Z",
      status: "failed",
    });

    await resetAllLocalData();

    expect(await db.sessions.count()).toBe(0);
    expect(await db.syncOutbox.count()).toBe(0);
  });

  it("is equivalent to clearDatabase", async () => {
    await db.playerProfiles.put({
      id: "player-1",
      organizationId: "org-default",
      displayName: "Ana",
      defaultSkillRating: 3,
      syncStatus: "pending",
    });

    await resetAllLocalData();
    expect(await db.playerProfiles.count()).toBe(0);

    await clearDatabase();
    expect(await db.playerProfiles.count()).toBe(0);
  });
});
