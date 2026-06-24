import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { createSessionLocal } from "./createSession.js";
import { checkInPlayerLocal } from "./checkInPlayer.js";
import { createQueuedMatchLocal } from "./queuedMatches.js";
import { moveQueuedMatchToCourtLocal, updateQueuedMatchLocal } from "./queuedMatches.js";
import { listPendingOutboxActions } from "../sync/outbox.js";
import { addPlayerToQueuedParticipants } from "../lib/queued-match-participants.js";

describe("queued match mutations", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  async function seedSessionWithFourPlayers() {
    await createSessionLocal({
      id: "session-1",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
      courtCount: 2,
    });

    for (let index = 0; index < 4; index += 1) {
      await checkInPlayerLocal({
        id: `check-in-${index}`,
        sessionId: "session-1",
        playerProfileId: `player-${index}`,
        playerDisplayName: `Player ${index}`,
        arrivalOrder: index,
        checkedInAt: `2026-06-09T18:0${index}:00.000Z`,
        sessionSkillRating: 3,
        paymentAmountDue: 150,
      });
    }

    const lane = await db.queueLanes.where("sessionId").equals("session-1").first();
    const court = await db.courts.where("sessionId").equals("session-1").first();
    return { laneId: lane!.id, courtId: court!.id };
  }

  it("creates draft then ready queued matches", async () => {
    const { laneId } = await seedSessionWithFourPlayers();

    const draft = await createQueuedMatchLocal({
      id: "queued-1",
      sessionId: "session-1",
      queueLaneId: laneId,
      participants: [],
    });
    expect(draft.status).toBe("draft");

    const ready = await createQueuedMatchLocal({
      id: "queued-2",
      sessionId: "session-1",
      queueLaneId: laneId,
      createdFrom: "suggestion",
      participants: [
        { checkInId: "check-in-0", playerProfileId: "player-0", team: "team_one", slotOrder: 1 },
        { checkInId: "check-in-1", playerProfileId: "player-1", team: "team_one", slotOrder: 2 },
        { checkInId: "check-in-2", playerProfileId: "player-2", team: "team_two", slotOrder: 1 },
        { checkInId: "check-in-3", playerProfileId: "player-3", team: "team_two", slotOrder: 2 },
      ],
    });
    expect(ready.status).toBe("ready");

    const pending = await listPendingOutboxActions("session-1");
    expect(pending.some((action) => action.type === "CREATE_QUEUED_MATCH")).toBe(true);
  });

  it("updates a draft match to ready when filling slots via participant helper", async () => {
    const { laneId } = await seedSessionWithFourPlayers();
    await createQueuedMatchLocal({
      id: "queued-draft",
      sessionId: "session-1",
      queueLaneId: laneId,
      participants: [],
    });

    let participants = addPlayerToQueuedParticipants([], {
      checkInId: "check-in-0",
      playerProfileId: "player-0",
      team: "team_one",
      slotOrder: 1,
    });
    participants = addPlayerToQueuedParticipants(participants, {
      checkInId: "check-in-1",
      playerProfileId: "player-1",
      team: "team_one",
      slotOrder: 2,
    });
    participants = addPlayerToQueuedParticipants(participants, {
      checkInId: "check-in-2",
      playerProfileId: "player-2",
      team: "team_two",
      slotOrder: 1,
    });
    participants = addPlayerToQueuedParticipants(participants, {
      checkInId: "check-in-3",
      playerProfileId: "player-3",
      team: "team_two",
      slotOrder: 2,
    });

    const updated = await updateQueuedMatchLocal({
      sessionId: "session-1",
      queuedMatchId: "queued-draft",
      participants,
    });
    expect(updated.status).toBe("ready");
    expect(updated.participants).toHaveLength(4);

    const checkIn = await db.checkIns.get("check-in-0");
    expect(checkIn?.queueStatus).toBe("assigned");

    const pending = await listPendingOutboxActions("session-1");
    expect(pending.some((action) => action.type === "UPDATE_QUEUED_MATCH")).toBe(true);
  });

  it("promotes a ready queued match to court", async () => {
    const { laneId, courtId } = await seedSessionWithFourPlayers();
    await createQueuedMatchLocal({
      id: "queued-ready",
      sessionId: "session-1",
      queueLaneId: laneId,
      participants: [
        { checkInId: "check-in-0", playerProfileId: "player-0", team: "team_one", slotOrder: 1 },
        { checkInId: "check-in-1", playerProfileId: "player-1", team: "team_one", slotOrder: 2 },
        { checkInId: "check-in-2", playerProfileId: "player-2", team: "team_two", slotOrder: 1 },
        { checkInId: "check-in-3", playerProfileId: "player-3", team: "team_two", slotOrder: 2 },
      ],
    });

    await moveQueuedMatchToCourtLocal({
      sessionId: "session-1",
      queuedMatchId: "queued-ready",
      courtId,
      matchId: "match-1",
      assignedAt: "2026-06-09T18:30:00.000Z",
    });

    const match = await db.matches.get("match-1");
    expect(match?.status).toBe("assigned");
    expect(match?.participants).toHaveLength(4);

    const pending = await listPendingOutboxActions("session-1");
    expect(pending.some((action) => action.type === "MOVE_QUEUED_MATCH_TO_COURT")).toBe(true);
  });
});
