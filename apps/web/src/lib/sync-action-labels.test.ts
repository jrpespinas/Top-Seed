import { describe, expect, it } from "vitest";
import { describeSyncAction } from "./sync-action-labels.js";
import type { OutboxAction } from "../db/types.js";
import type { SyncActionLabelContext } from "./sync-action-labels.js";

const emptyContext: SyncActionLabelContext = {
  checkIns: new Map(),
  courts: new Map(),
  queueLanes: new Map(),
  queuedMatches: new Map(),
  matches: new Map(),
  playerProfiles: new Map(),
};

const paymentAction: OutboxAction = {
  id: "action-1",
  organizationId: "org-default",
  type: "UPDATE_PAYMENT",
  entityType: "checkIn",
  entityId: "check-in-1",
  sessionId: "session-1",
  payload: {},
  createdAt: "2026-06-09T10:00:00.000Z",
  status: "failed",
};

describe("sync-action-labels", () => {
  it("labels payment updates with player name", () => {
    const context: SyncActionLabelContext = {
      ...emptyContext,
      checkIns: new Map([
        [
          "check-in-1",
          {
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
            syncStatus: "pending",
          },
        ],
      ]),
    };

    expect(describeSyncAction(paymentAction, context).label).toBe("Mark Ana paid");
  });

  it("labels complete match with court name", () => {
    const context: SyncActionLabelContext = {
      ...emptyContext,
      matches: new Map([
        [
          "match-1",
          {
            id: "match-1",
            sessionId: "session-1",
            courtId: "court-1",
            status: "completed",
            participants: [],
          },
        ],
      ]),
      courts: new Map([
        ["court-1", { id: "court-1", sessionId: "session-1", name: "Court 2", status: "open", sortOrder: 1 }],
      ]),
    };

    expect(
      describeSyncAction(
        { ...paymentAction, id: "a2", type: "COMPLETE_MATCH", entityType: "match", entityId: "match-1" },
        context,
      ).label,
    ).toBe("Record Court 2 result");
  });
});
