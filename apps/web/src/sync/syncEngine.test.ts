import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { checkInPlayerLocal } from "../mutations/checkInPlayer.js";
import { flushOutbox } from "../sync/syncEngine.js";
import * as connection from "../sync/connection.js";
import * as sessionApi from "../lib/session-api.js";

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
    vi.spyOn(sessionApi, "ensureSessionOnServer").mockResolvedValue();
    vi.spyOn(sessionApi, "sessionExistsOnServer").mockResolvedValue(true);
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
        text: async () =>
          JSON.stringify({
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

  it("bootstraps the session on server when sync returns session not found", async () => {
    vi.spyOn(connection, "getConnectionStatus").mockReturnValue(true);
    const ensureSession = vi
      .spyOn(sessionApi, "ensureSessionOnServer")
      .mockResolvedValue();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            organizationId: "org-default",
            deviceId: "device-1",
            processedAt: "2026-06-09T10:01:00.000Z",
            results: [
              {
                actionId: "sync-delete-court",
                status: "failed",
                entityType: "court",
                entityId: "session-1-court-3",
                errorCode: "VALIDATION_ERROR",
                message: "Session not found.",
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            organizationId: "org-default",
            deviceId: "device-1",
            processedAt: "2026-06-09T10:02:00.000Z",
            results: [
              {
                actionId: "sync-delete-court",
                status: "applied",
                entityType: "court",
                entityId: "session-1-court-3",
                serverUpdatedAt: "2026-06-09T10:02:00.000Z",
              },
            ],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await db.courts.put({
      id: "session-1-court-3",
      sessionId: SESSION.id,
      name: "Court 3",
      sortOrder: 2,
      status: "open",
    });

    await db.syncOutbox.put({
      id: "sync-delete-court",
      organizationId: "org-default",
      type: "UPDATE_COURT",
      entityType: "court",
      entityId: "session-1-court-3",
      sessionId: SESSION.id,
      payload: { name: "Court 3", sortOrder: 2, status: "open" },
      createdAt: "2026-06-09T10:00:00.000Z",
      status: "pending",
    });

    const result = await flushOutbox(SESSION.id);
    expect(result.flushed).toBe(1);
    expect(ensureSession).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bootstraps session structure when sync returns check-in not found", async () => {
    vi.spyOn(connection, "getConnectionStatus").mockReturnValue(true);
    const ensureSession = vi
      .spyOn(sessionApi, "ensureSessionOnServer")
      .mockResolvedValue();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            organizationId: "org-default",
            deviceId: "device-1",
            processedAt: "2026-06-09T10:01:00.000Z",
            results: [
              {
                actionId: "sync-queued-match",
                status: "failed",
                entityType: "queuedMatch",
                entityId: "queued-1",
                errorCode: "VALIDATION_ERROR",
                message: "Check-in not found.",
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            organizationId: "org-default",
            deviceId: "device-1",
            processedAt: "2026-06-09T10:02:00.000Z",
            results: [
              {
                actionId: "sync-queued-match",
                status: "applied",
                entityType: "queuedMatch",
                entityId: "queued-1",
                serverUpdatedAt: "2026-06-09T10:02:00.000Z",
              },
            ],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await db.syncOutbox.put({
      id: "sync-queued-match",
      organizationId: "org-default",
      type: "CREATE_QUEUED_MATCH",
      entityType: "queuedMatch",
      entityId: "queued-1",
      sessionId: SESSION.id,
      payload: {
        sessionId: SESSION.id,
        queueLaneId: "lane-1",
        sortOrder: 0,
        createdFrom: "manual",
        participants: [],
      },
      createdAt: "2026-06-09T10:00:00.000Z",
      status: "pending",
    });

    const result = await flushOutbox(SESSION.id);
    expect(result.flushed).toBe(1);
    expect(ensureSession).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("marks check-in applied when server reports player already checked in", async () => {
    vi.spyOn(connection, "getConnectionStatus").mockReturnValue(true);
    vi.spyOn(sessionApi, "ensureSessionOnServer").mockResolvedValue();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            organizationId: "org-default",
            deviceId: "device-1",
            processedAt: "2026-06-09T10:01:00.000Z",
            results: [
              {
                actionId: "sync-checkin-bogs",
                status: "failed",
                entityType: "checkIn",
                entityId: "check-in-bogs",
                errorCode: "VALIDATION_ERROR",
                message: "Player is already checked in.",
              },
            ],
          }),
      }),
    );

    await db.checkIns.put({
      id: "check-in-bogs",
      sessionId: SESSION.id,
      playerProfileId: "player-bogs",
      playerDisplayName: "Bogs",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      queueStatus: "waiting",
      sessionSkillRating: 3,
      paymentStatus: "unpaid",
      paymentAmountDue: 200,
      paymentAmountPaid: 0,
      paymentMethod: "none",
      paymentNotes: "",
      syncStatus: "failed",
      lastSyncError: "Player is already checked in.",
    });

    await db.syncOutbox.put({
      id: "sync-checkin-bogs",
      organizationId: "org-default",
      type: "CHECK_IN_PLAYER",
      entityType: "checkIn",
      entityId: "check-in-bogs",
      sessionId: SESSION.id,
      payload: {
        sessionId: SESSION.id,
        playerProfileId: "player-bogs",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T10:00:00.000Z",
        sessionSkillRating: 3,
        paymentAmountDue: 200,
      },
      createdAt: "2026-06-09T10:00:00.000Z",
      status: "pending",
    });

    const result = await flushOutbox(SESSION.id);
    expect(result.flushed).toBe(1);

    const checkIn = await db.checkIns.get("check-in-bogs");
    expect(checkIn?.syncStatus).toBe("synced");
    expect(checkIn?.lastSyncError).toBeUndefined();
  });
});
