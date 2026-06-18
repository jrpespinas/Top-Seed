import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { enqueueSyncAction, listBlockedOutboxActions } from "./outbox.js";
import { flushOutbox, markDependentsBlocked, retryOutboxAction } from "./syncEngine.js";
import * as connection from "./connection.js";

const baseAction = {
  organizationId: "org-default",
  type: "CHECK_IN_PLAYER",
  entityType: "checkIn",
  entityId: "check-in-1",
  sessionId: "session-1",
  payload: { sessionId: "session-1" },
};

describe("syncEngine blocked actions", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.restoreAllMocks();
  });

  it("marks later session actions blocked when parent fails", async () => {
    await enqueueSyncAction({
      ...baseAction,
      id: "action-failed",
      createdAt: "2026-06-09T10:00:00.000Z",
      status: "failed",
    });
    await enqueueSyncAction({
      ...baseAction,
      id: "action-later",
      entityId: "check-in-2",
      type: "UPDATE_PAYMENT",
      createdAt: "2026-06-09T10:01:00.000Z",
    });

    const failed = await db.syncOutbox.get("action-failed");
    await markDependentsBlocked(failed!);

    const blocked = await listBlockedOutboxActions("session-1");
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.blockedByActionId).toBe("action-failed");
  });

  it("retryOutboxAction unblocks dependents and re-queues flush", async () => {
    vi.spyOn(connection, "getConnectionStatus").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          organizationId: "org-default",
          deviceId: "device-1",
          processedAt: "2026-06-09T10:02:00.000Z",
          results: [{ actionId: "action-failed", status: "applied", entityType: "checkIn", entityId: "check-in-1" }],
        }),
      }),
    );

    await db.sessions.put({
      id: "session-1",
      organizationId: "org-default",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T09:00:00.000Z",
      status: "active",
      feeAmount: 150,
      currency: "PHP",
      queueMode: "suggested",
      ratingMode: "casual",
    });
    await db.checkIns.put({
      id: "check-in-1",
      sessionId: "session-1",
      playerProfileId: "player-1",
      playerDisplayName: "Ana",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T10:00:00.000Z",
      queueStatus: "waiting",
      sessionSkillRating: 3,
      paymentStatus: "unpaid",
      paymentAmountDue: 150,
      paymentAmountPaid: 0,
      paymentMethod: "none",
      paymentNotes: "",
      syncStatus: "failed",
      lastSyncError: "fail",
    });

    await enqueueSyncAction({
      ...baseAction,
      id: "action-failed",
      createdAt: "2026-06-09T10:00:00.000Z",
      status: "failed",
      errorMessage: "Network down",
    });
    await enqueueSyncAction({
      ...baseAction,
      id: "action-later",
      entityId: "check-in-2",
      type: "UPDATE_PAYMENT",
      createdAt: "2026-06-09T10:01:00.000Z",
      status: "blocked",
      blockedByActionId: "action-failed",
    });

    await retryOutboxAction("action-failed");

    const later = await db.syncOutbox.get("action-later");
    expect(later?.blockedByActionId).toBeUndefined();
    expect(later?.status === "pending" || later?.status === "applied").toBe(true);
  });
});
