import { describe, expect, it } from "vitest";
import {
  applySessionCompleteToCheckIns,
  cancelMatchParticipantStatus,
  checkInInitialStatus,
  clearPlayerFromOtherQueuedMatches,
  queuedMatchStatusForParticipantCount,
  removeQueuedMatchesInLane,
  resolvePostMatchQueueStatus,
  validateCompleteMatch,
  validateCourtAssignment,
  validateDeleteQueueLane,
  validateMarkDoneOrRemoved,
  validatePromoteQueuedMatch,
  validateSessionComplete,
  validateStartMatch,
} from "./index.js";
import type { CheckIn, Court, Match, QueuedMatch, QueueLane } from "../types/index.js";

describe("player transitions", () => {
  it("check-in creates waiting status", () => {
    expect(checkInInitialStatus()).toBe("waiting");
  });

  it("fourth participant upgrades queued match to ready", () => {
    expect(queuedMatchStatusForParticipantCount(3)).toBe("draft");
    expect(queuedMatchStatusForParticipantCount(4)).toBe("ready");
  });

  it("complete match returns waiting when not staged elsewhere", () => {
    const queuedMatches: QueuedMatch[] = [];
    expect(resolvePostMatchQueueStatus("c1", queuedMatches)).toBe("waiting");
  });

  it("complete match keeps assigned when still staged elsewhere", () => {
    const queuedMatches: QueuedMatch[] = [
      {
        id: "qm2",
        laneId: "lane-2",
        status: "draft",
        participants: [{ checkInId: "c1", playerProfileId: "p1" }],
      },
    ];
    expect(resolvePostMatchQueueStatus("c1", queuedMatches)).toBe("assigned");
  });

  it("blocks done or removed while playing", () => {
    const result = validateMarkDoneOrRemoved("playing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLAYER_IS_PLAYING");
    }
  });

  it("cancel match returns participants to waiting", () => {
    expect(cancelMatchParticipantStatus()).toBe("waiting");
  });
});

describe("queued match transitions", () => {
  const readyMatch: QueuedMatch = {
    id: "qm1",
    laneId: "lane-1",
    status: "ready",
    participants: [
      { checkInId: "c1", playerProfileId: "p1" },
      { checkInId: "c2", playerProfileId: "p2" },
      { checkInId: "c3", playerProfileId: "p3" },
      { checkInId: "c4", playerProfileId: "p4" },
    ],
  };

  it("promote ready queued match to court", () => {
    const court: Court = { id: "court-1", status: "open", currentMatchId: null };
    const result = validatePromoteQueuedMatch(readyMatch, court);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("promoted");
    }
  });

  it("rejects promote when queued match is incomplete", () => {
    const court: Court = { id: "court-1", status: "open", currentMatchId: null };
    const draft: QueuedMatch = { ...readyMatch, status: "draft", participants: readyMatch.participants.slice(0, 3) };
    const result = validatePromoteQueuedMatch(draft, court);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("QUEUED_MATCH_NOT_READY");
    }
  });

  it("promote removes duplicate staged slots in other lanes", () => {
    const queuedMatches: QueuedMatch[] = [
      readyMatch,
      {
        id: "qm2",
        laneId: "lane-2",
        status: "ready",
        participants: [
          { checkInId: "c1", playerProfileId: "p1" },
          { checkInId: "c5", playerProfileId: "p5" },
          { checkInId: "c6", playerProfileId: "p6" },
          { checkInId: "c7", playerProfileId: "p7" },
        ],
      },
    ];
    const updated = clearPlayerFromOtherQueuedMatches(
      "qm1",
      ["c1", "c2", "c3", "c4"],
      queuedMatches,
    );
    const laneTwo = updated.find((qm) => qm.id === "qm2");
    expect(laneTwo?.participants.some((p) => p.checkInId === "c1")).toBe(false);
    expect(laneTwo?.status).toBe("draft");
  });

  it("allows same player in two lanes before promotion", () => {
    const queuedMatches: QueuedMatch[] = [
      {
        id: "qm1",
        laneId: "lane-1",
        status: "draft",
        participants: [{ checkInId: "c1", playerProfileId: "p1" }],
      },
      {
        id: "qm2",
        laneId: "lane-2",
        status: "draft",
        participants: [{ checkInId: "c1", playerProfileId: "p1" }],
      },
    ];
    expect(queuedMatches[0]?.participants[0]?.checkInId).toBe(
      queuedMatches[1]?.participants[0]?.checkInId,
    );
  });
});

describe("match and court transitions", () => {
  const assignedMatch: Match = {
    id: "m1",
    courtId: "court-1",
    status: "assigned",
    outcome: null,
    winningTeam: null,
    startedAt: null,
    endedAt: null,
    completedAt: null,
    participants: [
      { checkInId: "c1", playerProfileId: "p1", team: "team_one" },
      { checkInId: "c2", playerProfileId: "p2", team: "team_one" },
      { checkInId: "c3", playerProfileId: "p3", team: "team_two" },
      { checkInId: "c4", playerProfileId: "p4", team: "team_two" },
    ],
  };

  it("start match moves to in_progress", () => {
    const result = validateStartMatch(assignedMatch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("in_progress");
    }
  });

  it("complete requires in_progress", () => {
    const notStarted = validateCompleteMatch(assignedMatch);
    expect(notStarted.ok).toBe(false);

    const started = validateCompleteMatch({ ...assignedMatch, status: "in_progress" });
    expect(started.ok).toBe(true);
  });

  it("paused court rejects assignment", () => {
    const court: Court = { id: "court-1", status: "paused", currentMatchId: null };
    const result = validateCourtAssignment(court);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COURT_NOT_OPEN");
    }
  });

  it("occupied court rejects assignment", () => {
    const court: Court = { id: "court-1", status: "occupied", currentMatchId: "m9" };
    const result = validateCourtAssignment(court);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COURT_ALREADY_OCCUPIED");
    }
  });
});

describe("session and lane transitions", () => {
  it("session complete blocked while match assigned", () => {
    const matches: Match[] = [
      {
        id: "m1",
        courtId: "court-1",
        status: "assigned",
        outcome: null,
        winningTeam: null,
        startedAt: null,
        endedAt: null,
        completedAt: null,
        participants: [],
      },
    ];
    const result = validateSessionComplete("active", matches);
    expect(result.ok).toBe(false);
  });

  it("session complete marks waiting and resting as done", () => {
    const checkIns: CheckIn[] = [
      {
        id: "c1",
        playerProfileId: "p1",
        queueStatus: "waiting",
        sessionSkillRating: 3,
        arrivalOrder: 1,
        checkedInAt: "2026-06-09T18:00:00.000Z",
        matchesPlayedInSession: 0,
        lastMatchEndedAt: null,
        paymentStatus: "unpaid",
        paymentAmountDue: 250,
        paymentAmountPaid: 0,
      },
      {
        id: "c2",
        playerProfileId: "p2",
        queueStatus: "resting",
        sessionSkillRating: 3,
        arrivalOrder: 2,
        checkedInAt: "2026-06-09T18:05:00.000Z",
        matchesPlayedInSession: 0,
        lastMatchEndedAt: null,
        paymentStatus: "unpaid",
        paymentAmountDue: 250,
        paymentAmountPaid: 0,
      },
    ];
    const updated = applySessionCompleteToCheckIns(checkIns);
    expect(updated.every((c) => c.queueStatus === "done")).toBe(true);
  });

  it("cannot delete final active queue lane", () => {
    const lanes: QueueLane[] = [{ id: "lane-1", isActive: true }];
    const result = validateDeleteQueueLane(lanes, "lane-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("QUEUE_LANE_REQUIRED");
    }
  });

  it("lane deletion removes queued matches in that lane", () => {
    const queuedMatches: QueuedMatch[] = [
      {
        id: "qm1",
        laneId: "lane-1",
        status: "ready",
        participants: [{ checkInId: "c1", playerProfileId: "p1" }],
      },
      {
        id: "qm2",
        laneId: "lane-2",
        status: "ready",
        participants: [{ checkInId: "c2", playerProfileId: "p2" }],
      },
    ];
    const updated = removeQueuedMatchesInLane(queuedMatches, "lane-1");
    expect(updated.find((qm) => qm.id === "qm1")?.status).toBe("removed");
    expect(updated.find((qm) => qm.id === "qm2")?.status).toBe("ready");
  });
});
