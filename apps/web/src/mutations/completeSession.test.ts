import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { completeSessionLocal } from "./completeSession.js";
import { createSessionLocal } from "./createSession.js";
import { listPendingOutboxActions } from "../sync/outbox.js";

describe("completeSessionLocal", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("marks a live session completed and enqueues COMPLETE_SESSION", async () => {
    await createSessionLocal({
      id: "session-1",
      name: "Night A",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
    });

    const updated = await completeSessionLocal("session-1", { syncActionId: "complete-1" });
    expect(updated.status).toBe("completed");

    const pending = await listPendingOutboxActions("session-1");
    const completeAction = pending.find((action) => action.type === "COMPLETE_SESSION");
    expect(completeAction?.id).toBe("complete-1");

    const stored = await db.sessions.get("session-1");
    expect(stored?.status).toBe("completed");
  });

  it("rejects completing an already ended session", async () => {
    await createSessionLocal({
      id: "session-2",
      name: "Night B",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
    });
    await completeSessionLocal("session-2");

    await expect(completeSessionLocal("session-2")).rejects.toThrow("Only live sessions");
  });
});
