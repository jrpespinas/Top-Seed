import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { createSessionLocal } from "./createSession.js";
import { listPendingOutboxActions } from "../sync/outbox.js";

describe("createSessionLocal", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("writes session, lane, courts, and outbox actions", async () => {
    const result = await createSessionLocal(
      {
        id: "session-new-1",
        name: "Friday Open Play",
        venueName: "Main Hall",
        startsAt: "2026-06-09T18:00:00.000Z",
        feeAmount: 150,
        currency: "PHP",
        courtCount: 3,
        queueMode: "suggested",
        ratingMode: "casual",
        startImmediately: true,
      },
      { createActionId: "create-action-1", startActionId: "start-action-1" },
    );

    expect(result.session.status).toBe("active");
    expect(result.courts).toHaveLength(3);
    expect(result.lane.name).toBe("Next");

    const stored = await db.sessions.get("session-new-1");
    expect(stored?.name).toBe("Friday Open Play");

    const courts = await db.courts.where("sessionId").equals("session-new-1").toArray();
    expect(courts).toHaveLength(3);

    const pending = await listPendingOutboxActions("session-new-1");
    expect(pending.map((action) => action.type)).toEqual(["CREATE_SESSION", "START_SESSION"]);
    expect(pending[0]?.id).toBe("create-action-1");
    expect(pending[0]?.payload).toMatchObject({
      name: "Friday Open Play",
      venueName: "Main Hall",
      queueMode: "suggested",
      ratingMode: "casual",
    });
  });
});
