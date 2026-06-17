import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { checkInPlayerLocal } from "../mutations/checkInPlayer.js";
import { flushOutbox } from "../sync/syncEngine.js";
import * as connection from "../sync/connection.js";

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

describe("syncEngine", () => {
  beforeEach(async () => {
    await clearDatabase();
    await db.sessions.put(SESSION);
    vi.restoreAllMocks();
  });

  it("does not flush when offline", async () => {
    vi.spyOn(connection, "getConnectionStatus").mockReturnValue(false);

    await checkInPlayerLocal({
      id: "check-in-1",
      sessionId: SESSION.id,
      playerProfileId: "player-1",
      playerDisplayName: "Alex",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      sessionSkillRating: 1200,
      paymentAmountDue: 150,
    });

    const result = await flushOutbox(SESSION.id);
    expect(result).toEqual({ flushed: 0, failed: 0 });

    const checkIn = await db.checkIns.get("check-in-1");
    expect(checkIn?.syncStatus).toBe("pending");
  });

  it("marks check-in synced when server applies action", async () => {
    vi.spyOn(connection, "getConnectionStatus").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          organizationId: "org-default",
          deviceId: "device-1",
          processedAt: "2026-06-09T10:01:00.000Z",
          results: [
            {
              actionId: "sync-action-1",
              status: "applied",
              entityType: "checkIn",
              entityId: "check-in-1",
              serverUpdatedAt: "2026-06-09T10:01:00.000Z",
            },
          ],
        }),
      }),
    );

    await checkInPlayerLocal(
      {
        id: "check-in-1",
        sessionId: SESSION.id,
        playerProfileId: "player-1",
        playerDisplayName: "Alex",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T10:00:00.000Z",
        sessionSkillRating: 1200,
        paymentAmountDue: 150,
      },
      { syncActionId: "sync-action-1" },
    );

    const result = await flushOutbox(SESSION.id);
    expect(result.flushed).toBe(1);

    const checkIn = await db.checkIns.get("check-in-1");
    expect(checkIn?.syncStatus).toBe("synced");
    expect(checkIn?.lastSyncedAt).toBe("2026-06-09T10:01:00.000Z");
  });

  it("marks check-in failed when sync request throws", async () => {
    vi.spyOn(connection, "getConnectionStatus").mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")));

    await checkInPlayerLocal(
      {
        id: "check-in-2",
        sessionId: SESSION.id,
        playerProfileId: "player-2",
        playerDisplayName: "Jordan",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T10:00:00.000Z",
        sessionSkillRating: 1150,
        paymentAmountDue: 150,
      },
      { syncActionId: "sync-action-2" },
    );

    const result = await flushOutbox(SESSION.id);
    expect(result.failed).toBe(1);

    const checkIn = await db.checkIns.get("check-in-2");
    expect(checkIn?.syncStatus).toBe("failed");
    expect(checkIn?.lastSyncError).toBe("Network down");
  });
});
