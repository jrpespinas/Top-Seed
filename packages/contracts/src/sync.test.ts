import { describe, expect, it } from "vitest";
import {
  syncActionsRequestSchema,
  createQueuedMatchPayloadSchema,
  moveQueuedMatchToCourtPayloadSchema,
  completeMatchPayloadSchema,
} from "@top-seed/contracts";

describe("sync payload contracts", () => {
  it("parses CREATE_QUEUED_MATCH golden payload", () => {
    const payload = createQueuedMatchPayloadSchema.parse({
      sessionId: "session-friday",
      queueLaneId: "lane-queue-1",
      sortOrder: 0,
      status: "ready",
      createdFrom: "suggestion",
      participants: [
        { playerProfileId: "player-ana", checkInId: "ci-ana", team: "team_one", slotOrder: 1 },
        { playerProfileId: "player-ben", checkInId: "ci-ben", team: "team_one", slotOrder: 2 },
        { playerProfileId: "player-cara", checkInId: "ci-cara", team: "team_two", slotOrder: 1 },
        { playerProfileId: "player-dan", checkInId: "ci-dan", team: "team_two", slotOrder: 2 },
      ],
    });
    expect(payload.participants).toHaveLength(4);
  });

  it("parses MOVE_QUEUED_MATCH_TO_COURT payload", () => {
    const payload = moveQueuedMatchToCourtPayloadSchema.parse({
      courtId: "court-1",
      matchId: "match-promoted-001",
      assignedAt: "2026-06-09T14:35:00.000Z",
    });
    expect(payload.matchId).toBe("match-promoted-001");
  });

  it("parses COMPLETE_MATCH payload", () => {
    const payload = completeMatchPayloadSchema.parse({
      outcome: "team_one_win",
      teamOneScore: 21,
      teamTwoScore: 18,
      winningTeam: "team_one",
      endedAt: "2026-06-09T14:50:00.000Z",
    });
    expect(payload.outcome).toBe("team_one_win");
  });

  it("parses sync batch request", () => {
    const request = syncActionsRequestSchema.parse({
      organizationId: "org-default",
      deviceId: "device-1",
      actions: [
        {
          id: "sync-001",
          type: "CHECK_IN_PLAYER",
          entityType: "checkIn",
          entityId: "ci-1",
          sessionId: "session-1",
          payload: {
            sessionId: "session-1",
            playerProfileId: "player-1",
            arrivalOrder: 1,
            checkedInAt: "2026-06-09T18:00:00.000Z",
            sessionSkillRating: 3,
          },
          createdAt: "2026-06-09T18:00:00.000Z",
        },
      ],
    });
    expect(request.actions).toHaveLength(1);
  });
});
