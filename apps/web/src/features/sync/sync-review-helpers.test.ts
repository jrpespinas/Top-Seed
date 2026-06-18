import { describe, expect, it } from "vitest";
import { groupSyncActions } from "./sync-review-helpers.js";
import type { OutboxAction } from "../../db/types.js";

function action(id: string, status: OutboxAction["status"], createdAt: string): OutboxAction {
  return {
    id,
    organizationId: "org-default",
    type: "CHECK_IN_PLAYER",
    entityType: "checkIn",
    entityId: id,
    sessionId: "session-1",
    payload: {},
    createdAt,
    status,
  };
}

describe("sync-review-helpers", () => {
  it("groups failed before blocked and pending", () => {
    const grouped = groupSyncActions([
      action("pending", "pending", "2026-06-09T10:02:00.000Z"),
      action("blocked", "blocked", "2026-06-09T10:01:00.000Z"),
      action("failed", "failed", "2026-06-09T10:00:00.000Z"),
    ]);

    expect(grouped.failed.map((row) => row.id)).toEqual(["failed"]);
    expect(grouped.blocked.map((row) => row.id)).toEqual(["blocked"]);
    expect(grouped.pending.map((row) => row.id)).toEqual(["pending"]);
  });
});
