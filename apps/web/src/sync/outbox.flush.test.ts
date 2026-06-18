import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { createPlayerLocal } from "../mutations/createPlayer.js";
import { checkInPlayerLocal } from "../mutations/checkInPlayer.js";
import { createSessionLocal } from "../mutations/createSession.js";
import { listPendingForFlush } from "./outbox.js";
import { flushOutbox } from "./syncEngine.js";
import * as connection from "./connection.js";

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

describe("listPendingForFlush", () => {
  beforeEach(async () => {
    await clearDatabase();
    await db.sessions.put(SESSION);
  });

  it("includes org-scoped CREATE_PLAYER_PROFILE before session check-in when flushing by session", async () => {
    await createPlayerLocal({
      id: "player-bogs",
      displayName: "Bogs",
    });
    await checkInPlayerLocal({
      id: "check-in-bogs",
      sessionId: SESSION.id,
      playerProfileId: "player-bogs",
      playerDisplayName: "Bogs",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      sessionSkillRating: 3,
      paymentAmountDue: 150,
    });

    const pending = await listPendingForFlush(SESSION.id);
    expect(pending).toHaveLength(2);
    expect(pending[0]?.type).toBe("CREATE_PLAYER_PROFILE");
    expect(pending[1]?.type).toBe("CHECK_IN_PLAYER");
  });

  it("orders CREATE_SESSION before check-in when session startsAt is later than check-in time", async () => {
    const sessionId = "session-future-start";
    await createSessionLocal({
      id: sessionId,
      name: "Tuesday Intense",
      venueName: "LAI 20F",
      startsAt: "2026-06-23T11:00:00.000Z",
      feeAmount: 200,
      courtCount: 3,
    });

    await createPlayerLocal({ id: "player-bogs", displayName: "Bogs" });
    await checkInPlayerLocal({
      id: "check-in-bogs",
      sessionId,
      playerProfileId: "player-bogs",
      playerDisplayName: "Bogs",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      sessionSkillRating: 3,
      paymentAmountDue: 200,
    });

    const pending = await listPendingForFlush(sessionId);
    expect(pending[0]?.type).toBe("CREATE_SESSION");
    expect(pending[1]?.type).toBe("START_SESSION");
    expect(pending[2]?.type).toBe("CREATE_PLAYER_PROFILE");
    expect(pending[3]?.type).toBe("CHECK_IN_PLAYER");
  });
});

describe("flushOutbox walk-in ordering", () => {
  beforeEach(async () => {
    await clearDatabase();
    await db.sessions.put(SESSION);
    vi.restoreAllMocks();
  });

  it("posts profile create before check-in to sync API", async () => {
    vi.spyOn(connection, "getConnectionStatus").mockReturnValue(true);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organizationId: "org-default",
        deviceId: "device-1",
        processedAt: "2026-06-09T10:01:00.000Z",
        results: [
          {
            actionId: "sync-profile",
            status: "applied",
            entityType: "playerProfile",
            entityId: "player-bogs",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createPlayerLocal({ id: "player-bogs", displayName: "Bogs" }, { syncActionId: "sync-profile" });
    await checkInPlayerLocal(
      {
        id: "check-in-bogs",
        sessionId: SESSION.id,
        playerProfileId: "player-bogs",
        playerDisplayName: "Bogs",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T10:00:00.000Z",
        sessionSkillRating: 3,
        paymentAmountDue: 150,
      },
      { syncActionId: "sync-checkin" },
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        organizationId: "org-default",
        deviceId: "device-1",
        processedAt: "2026-06-09T10:01:00.000Z",
        results: [
          {
            actionId: "sync-profile",
            status: "applied",
            entityType: "playerProfile",
            entityId: "player-bogs",
          },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        organizationId: "org-default",
        deviceId: "device-1",
        processedAt: "2026-06-09T10:02:00.000Z",
        results: [
          {
            actionId: "sync-checkin",
            status: "applied",
            entityType: "checkIn",
            entityId: "check-in-bogs",
            serverUpdatedAt: "2026-06-09T10:02:00.000Z",
          },
        ],
      }),
    });

    const result = await flushOutbox(SESSION.id);
    expect(result.flushed).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(firstBody.actions[0]?.type).toBe("CREATE_PLAYER_PROFILE");

    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondBody.actions[0]?.type).toBe("CHECK_IN_PLAYER");

    const checkIn = await db.checkIns.get("check-in-bogs");
    expect(checkIn?.syncStatus).toBe("synced");
    const profile = await db.playerProfiles.get("player-bogs");
    expect(profile?.syncStatus).toBe("synced");
  });
});
