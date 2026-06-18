import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase } from "../db/database.js";
import {
  countOutboxByStatus,
  enqueueSyncAction,
  listFailedOutboxActions,
  listPendingOutboxActions,
  markOutboxApplied,
  markOutboxFailed,
  markOutboxBlocked,
  resetFailedToPending,
} from "./outbox.js";

const baseAction = {
  id: "action-1",
  organizationId: "org-default",
  type: "CHECK_IN_PLAYER",
  entityType: "checkIn",
  entityId: "check-in-1",
  sessionId: "session-1",
  payload: { sessionId: "session-1" },
  createdAt: "2026-06-09T10:00:00.000Z",
};

describe("sync outbox", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("enqueues with pending status by default", async () => {
    const action = await enqueueSyncAction(baseAction);
    expect(action.status).toBe("pending");
  });

  it("lists pending actions in createdAt order", async () => {
    await enqueueSyncAction({ ...baseAction, id: "a", createdAt: "2026-06-09T10:01:00.000Z" });
    await enqueueSyncAction({ ...baseAction, id: "b", createdAt: "2026-06-09T10:00:00.000Z" });

    const pending = await listPendingOutboxActions("session-1");
    expect(pending.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("preserves action id for idempotent replay", async () => {
    const action = await enqueueSyncAction({ ...baseAction, id: "stable-action-id" });
    const [loaded] = await listPendingOutboxActions();
    expect(loaded?.id).toBe(action.id);
    expect(loaded?.id).toBe("stable-action-id");
  });

  it("marks applied and clears error message", async () => {
    await enqueueSyncAction(baseAction);
    await markOutboxFailed(baseAction.id, "temporary");
    await markOutboxApplied(baseAction.id);

    const pending = await listPendingOutboxActions();
    expect(pending).toHaveLength(0);
  });

  it("tracks failed actions separately from pending", async () => {
    await enqueueSyncAction(baseAction);
    await markOutboxFailed(baseAction.id, "Network error");

    const failed = await listFailedOutboxActions("session-1");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.errorMessage).toBe("Network error");
    expect(await listPendingOutboxActions()).toHaveLength(0);
  });

  it("resets failed actions back to pending", async () => {
    await enqueueSyncAction(baseAction);
    await markOutboxFailed(baseAction.id, "Retry me");
    await resetFailedToPending(baseAction.id);

    const counts = await countOutboxByStatus("session-1");
    expect(counts.pending).toBe(1);
    expect(counts.failed).toBe(0);
  });

  it("counts pending and failed by session", async () => {
    await enqueueSyncAction(baseAction);
    await enqueueSyncAction({
      ...baseAction,
      id: "action-2",
      sessionId: "session-2",
    });
    await markOutboxFailed("action-2", "fail");

    const sessionOne = await countOutboxByStatus("session-1");
    expect(sessionOne).toEqual({ pending: 1, failed: 0, blocked: 0 });

    const sessionTwo = await countOutboxByStatus("session-2");
    expect(sessionTwo).toEqual({ pending: 0, failed: 1, blocked: 0 });
  });

  it("tracks blocked actions separately", async () => {
    await enqueueSyncAction(baseAction);
    await markOutboxFailed(baseAction.id, "fail");
    await enqueueSyncAction({ ...baseAction, id: "action-2", createdAt: "2026-06-09T10:01:00.000Z" });
    await markOutboxBlocked("action-2", baseAction.id);

    const counts = await countOutboxByStatus("session-1");
    expect(counts.blocked).toBe(1);
  });
});
