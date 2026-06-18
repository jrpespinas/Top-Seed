import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, db } from "../db/database.js";
import { createSessionLocal } from "./createSession.js";
import { checkInPlayerLocal } from "./checkInPlayer.js";
import { createQueuedMatchLocal, moveQueuedMatchToCourtLocal } from "./queuedMatches.js";
import { completeMatchLocal, startMatchLocal } from "./matches.js";
import { correctMatchResultLocal } from "./correctMatchResult.js";
import { listPendingOutboxActions } from "../sync/outbox.js";
import { buildSessionLeaderboardEntries } from "../lib/leaderboard-snapshot.js";

describe("correctMatchResultLocal", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  async function seedCompletedMatch() {
    await createSessionLocal({
      id: "session-1",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
      courtCount: 2,
      ratingMode: "rated",
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

    await createQueuedMatchLocal({
      id: "queued-ready",
      sessionId: "session-1",
      queueLaneId: lane!.id,
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
      courtId: court!.id,
      matchId: "match-1",
      assignedAt: "2026-06-09T18:30:00.000Z",
    });

    await startMatchLocal({
      sessionId: "session-1",
      matchId: "match-1",
      startedAt: "2026-06-09T18:35:00.000Z",
    });

    await completeMatchLocal({
      sessionId: "session-1",
      matchId: "match-1",
      result: { outcome: "team_one_win", winningTeam: "team_one", teamOneScore: 21, teamTwoScore: 15 },
    });
  }

  it("corrects win to draw and enqueues UPDATE_MATCH_RESULT", async () => {
    await seedCompletedMatch();

    await correctMatchResultLocal(
      {
        sessionId: "session-1",
        matchId: "match-1",
        result: {
          outcome: "draw",
          teamOneScore: 20,
          teamTwoScore: 20,
          winningTeam: null,
          correctionNote: "Wrong winner",
        },
      },
      { syncActionId: "sync-correct-1" },
    );

    const match = await db.matches.get("match-1");
    expect(match?.outcome).toBe("draw");

    const outbox = await listPendingOutboxActions("session-1");
    expect(outbox.some((action) => action.type === "UPDATE_MATCH_RESULT")).toBe(true);

    const session = (await db.sessions.get("session-1"))!;
    const entries = buildSessionLeaderboardEntries(
      session,
      await db.matches.toArray(),
      await db.checkIns.toArray(),
      await db.playerProfiles.toArray(),
    );
    const player0 = entries.find((entry) => entry.playerProfileId === "player-0");
    expect(player0?.draws).toBe(1);
    expect(player0?.wins).toBe(0);
  });
});
