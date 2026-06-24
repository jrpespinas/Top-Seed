/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { courtNameForIndex, createCourtLocal, deleteCourtLocal } from "./courts.js";
import { db, clearDatabase } from "../db/database.js";
import { createSessionLocal } from "./createSession.js";

describe("courts mutations", () => {
  beforeEach(async () => {
    await clearDatabase();
    await createSessionLocal({
      id: "session-1",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
      courtCount: 3,
    });
  });

  it("adds a court with the next sequential name", async () => {
    const court = await createCourtLocal({
      id: "court-4",
      sessionId: "session-1",
    });
    expect(court.name).toBe("Court 4");
    expect(court.sortOrder).toBe(3);

    const outbox = await db.syncOutbox.toArray();
    expect(outbox.some((row) => row.type === "CREATE_COURT")).toBe(true);
  });

  it("renumbers remaining courts after delete", async () => {
    await deleteCourtLocal({ sessionId: "session-1", courtId: "session-1-court-1" });

    const courts = await db.courts.where("sessionId").equals("session-1").sortBy("sortOrder");
    expect(courts.map((court) => court.name)).toEqual(["Court 1", "Court 2"]);

    const outbox = await db.syncOutbox.toArray();
    expect(outbox.some((row) => row.type === "DELETE_COURT")).toBe(true);
    expect(outbox.some((row) => row.type === "UPDATE_COURT")).toBe(true);
  });

  it("detaches completed matches and deletes court with history", async () => {
    await db.matches.put({
      id: "match-1",
      sessionId: "session-1",
      courtId: "session-1-court-1",
      status: "completed",
      outcome: "team_one_win",
      winningTeam: "team_one",
      participants: [],
      syncStatus: "synced",
    });

    await deleteCourtLocal({ sessionId: "session-1", courtId: "session-1-court-1" });

    const match = await db.matches.get("match-1");
    expect(match?.courtId).toBeNull();
    expect(match?.status).toBe("completed");

    const courts = await db.courts.where("sessionId").equals("session-1").sortBy("sortOrder");
    expect(courts.map((court) => court.name)).toEqual(["Court 1", "Court 2"]);
  });

  it("rejects deleting the last court", async () => {
    await deleteCourtLocal({ sessionId: "session-1", courtId: "session-1-court-1" });
    await deleteCourtLocal({ sessionId: "session-1", courtId: "session-1-court-2" });
    await expect(
      deleteCourtLocal({ sessionId: "session-1", courtId: "session-1-court-3" }),
    ).rejects.toThrow(/At least one court/);
  });

  it("names courts sequentially by index", () => {
    expect(courtNameForIndex(0)).toBe("Court 1");
    expect(courtNameForIndex(2)).toBe("Court 3");
  });
});
