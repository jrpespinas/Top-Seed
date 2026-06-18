import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { createSessionLocal } from "./createSession.js";
import { createQueuedMatchLocal } from "./queuedMatches.js";
import { deleteQueueLaneLocal } from "./queueLanes.js";

describe("deleteQueueLaneLocal", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("removes queued matches in the deleted lane", async () => {
    await createSessionLocal({
      id: "session-1",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
    });

    const lanes = await db.queueLanes.where("sessionId").equals("session-1").toArray();
    const lane = lanes[0]!;
    await createQueuedMatchLocal({
      id: "queued-1",
      sessionId: "session-1",
      queueLaneId: lane.id,
      participants: [],
    });

    await deleteQueueLaneLocal({ sessionId: "session-1", laneId: lane.id }).catch(() => {
      // cannot delete last lane — add second lane first
    });

    await db.queueLanes.add({
      id: "lane-2",
      sessionId: "session-1",
      name: "Queue 2",
      sortOrder: 1,
      status: "open",
    });

    await deleteQueueLaneLocal({ sessionId: "session-1", laneId: lane.id });

    const queued = await db.queuedMatches.get("queued-1");
    expect(queued?.status).toBe("removed");
  });
});
