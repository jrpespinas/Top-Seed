import { describe, expect, it } from "vitest";
import {
  courtDropId,
  parseDragId,
  parseDropId,
  playerDragId,
  queuedMatchDragId,
  queuedPlayerDragId,
  queuedSlotDropId,
} from "./drag-types.js";

describe("drag-types", () => {
  it("round-trips player drag id", () => {
    const id = playerDragId("check-in-1");
    expect(parseDragId(id, "session-1")).toEqual({
      kind: "player",
      sessionId: "session-1",
      checkInId: "check-in-1",
      sourceZone: "available",
    });
  });

  it("round-trips queued match drag id", () => {
    const id = queuedMatchDragId("qm-1");
    expect(parseDragId(id, "session-1")).toEqual({
      kind: "queued-match",
      sessionId: "session-1",
      queuedMatchId: "qm-1",
      sourceZone: "next",
    });
  });

  it("round-trips queued player drag id", () => {
    const id = queuedPlayerDragId("qm-1", "check-in-2");
    expect(parseDragId(id, "session-1")).toEqual({
      kind: "queued-player",
      sessionId: "session-1",
      queuedMatchId: "qm-1",
      checkInId: "check-in-2",
      sourceZone: "next",
    });
  });

  it("round-trips queued slot drop id", () => {
    const id = queuedSlotDropId("qm-1", "team_two", 2);
    expect(parseDropId(id, "session-1")).toEqual({
      kind: "queued-slot",
      sessionId: "session-1",
      queuedMatchId: "qm-1",
      team: "team_two",
      slotOrder: 2,
    });
  });

  it("round-trips court drop id", () => {
    const id = courtDropId("court-2");
    expect(parseDropId(id, "session-1")).toEqual({
      kind: "court",
      sessionId: "session-1",
      courtId: "court-2",
    });
  });
});
