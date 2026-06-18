import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import type { LocalCheckIn } from "../db/types.js";

describe("TopSeedDatabase", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("opens the v1 schema", async () => {
    expect(db.verno).toBe(3);
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        "checkIns",
        "courts",
        "matches",
        "playerProfiles",
        "queueLanes",
        "queuedMatches",
        "sessions",
        "syncOutbox",
      ].sort(),
    );
  });

  it("persists a check-in across reads", async () => {
    const checkIn: LocalCheckIn = {
      id: "check-in-1",
      sessionId: "session-1",
      playerProfileId: "player-1",
      playerDisplayName: "Alex",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      queueStatus: "waiting",
      sessionSkillRating: 1200,
      paymentStatus: "unpaid",
      paymentAmountDue: 150,
      paymentAmountPaid: 0,
      paymentMethod: "none",
      paymentNotes: "",
      syncStatus: "pending",
    };

    await db.checkIns.put(checkIn);
    const loaded = await db.checkIns.get("check-in-1");
    expect(loaded).toEqual(checkIn);
  });

  it("indexes check-ins by sessionId", async () => {
    await db.checkIns.bulkPut([
      {
        id: "a",
        sessionId: "s1",
        playerProfileId: "p1",
        playerDisplayName: "A",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T10:00:00.000Z",
        queueStatus: "waiting",
        sessionSkillRating: 1200,
        paymentStatus: "unpaid",
        paymentAmountDue: 150,
        paymentAmountPaid: 0,
        paymentMethod: "none",
        paymentNotes: "",
        syncStatus: "pending",
      },
      {
        id: "b",
        sessionId: "s2",
        playerProfileId: "p2",
        playerDisplayName: "B",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T10:00:00.000Z",
        queueStatus: "waiting",
        sessionSkillRating: 1100,
        paymentStatus: "unpaid",
        paymentAmountDue: 150,
        paymentAmountPaid: 0,
        paymentMethod: "none",
        paymentNotes: "",
        syncStatus: "synced",
      },
    ]);

    const sessionOne = await db.checkIns.where("sessionId").equals("s1").toArray();
    expect(sessionOne).toHaveLength(1);
    expect(sessionOne[0]?.id).toBe("a");
  });

  it("clears all tables", async () => {
    await db.sessions.put({
      id: "s1",
      organizationId: "org",
      name: "Test",
      venueName: "Gym",
      startsAt: "2026-06-09T10:00:00.000Z",
      status: "active",
      feeAmount: 100,
      currency: "PHP",
      queueMode: "suggested",
      ratingMode: "casual",
    });
    await clearDatabase();
    expect(await db.sessions.count()).toBe(0);
  });
});
