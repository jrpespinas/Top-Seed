import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { ensureSessionStructureOnServer } from "./session-api.js";

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

describe("ensureSessionStructureOnServer", () => {
  beforeEach(async () => {
    await clearDatabase();
    await db.sessions.put(SESSION);
    vi.restoreAllMocks();
  });

  it("bootstraps missing player profiles and check-ins from local store", async () => {
    await db.playerProfiles.put({
      id: "player-1",
      organizationId: "org-default",
      displayName: "Alex",
      defaultSkillRating: 3,
      syncStatus: "synced",
    });
    await db.checkIns.put({
      id: "check-in-1",
      sessionId: SESSION.id,
      playerProfileId: "player-1",
      playerDisplayName: "Alex",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      queueStatus: "waiting",
      sessionSkillRating: 3,
      paymentStatus: "unpaid",
      paymentAmountDue: 150,
      paymentAmountPaid: 0,
      paymentMethod: "none",
      paymentNotes: "",
      syncStatus: "synced",
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            courts: [],
            checkIns: [],
            queue: { lanes: [] },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            organizationId: "org-default",
            deviceId: "device-1",
            processedAt: "2026-06-09T10:01:00.000Z",
            results: [
              {
                actionId: "bootstrap-profile",
                status: "applied",
                entityType: "playerProfile",
                entityId: "player-1",
              },
              {
                actionId: "bootstrap-checkin",
                status: "applied",
                entityType: "checkIn",
                entityId: "check-in-1",
              },
            ],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await ensureSessionStructureOnServer(SESSION.id);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const syncBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(syncBody.actions).toHaveLength(2);
    expect(syncBody.actions[0]?.type).toBe("CREATE_PLAYER_PROFILE");
    expect(syncBody.actions[0]?.entityId).toBe("player-1");
    expect(syncBody.actions[1]?.type).toBe("CHECK_IN_PLAYER");
    expect(syncBody.actions[1]?.entityId).toBe("check-in-1");
  });

  it("skips bootstrap check-in when player is already checked in on server", async () => {
    await db.playerProfiles.put({
      id: "player-1",
      organizationId: "org-default",
      displayName: "Alex",
      defaultSkillRating: 3,
      syncStatus: "synced",
    });
    await db.checkIns.put({
      id: "check-in-1",
      sessionId: SESSION.id,
      playerProfileId: "player-1",
      playerDisplayName: "Alex",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      queueStatus: "waiting",
      sessionSkillRating: 3,
      paymentStatus: "unpaid",
      paymentAmountDue: 150,
      paymentAmountPaid: 0,
      paymentMethod: "none",
      paymentNotes: "",
      syncStatus: "synced",
    });

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          courts: [],
          checkIns: [{ id: "server-check-in-1", playerProfileId: "player-1" }],
          queue: { lanes: [] },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await ensureSessionStructureOnServer(SESSION.id);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
