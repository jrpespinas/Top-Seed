import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDatabase, db } from "../../../db/database.js";
import { createSessionLocal } from "../../../mutations/createSession.js";
import { checkInPlayerLocal } from "../../../mutations/checkInPlayer.js";
import { createQueuedMatchLocal, updateQueuedMatchLocal } from "../../../mutations/queuedMatches.js";
import { addPlayerToQueuedParticipants } from "../../../lib/queued-match-participants.js";
import type { PegboardDropContext } from "./resolvePegboardDrop.js";
import { resolvePegboardDrop } from "./resolvePegboardDrop.js";
import type { LocalCheckIn, LocalQueuedMatch } from "../../../db/types.js";

const playerDrag = {
  kind: "player" as const,
  sessionId: "session-1",
  checkInId: "check-in-0",
  sourceZone: "available" as const,
};

const emptySlot = {
  kind: "queued-slot" as const,
  sessionId: "session-1",
  queuedMatchId: "queued-draft",
  team: "team_one" as const,
  slotOrder: 1 as const,
};

function baseContext(overrides: Partial<PegboardDropContext> = {}): PegboardDropContext {
  const checkIn: LocalCheckIn = {
    id: "check-in-0",
    sessionId: "session-1",
    playerProfileId: "player-0",
    playerDisplayName: "Player 0",
    queueStatus: "waiting",
    sessionSkillRating: 3,
    checkedInAt: "2026-06-09T18:00:00.000Z",
    matchesPlayedInSession: 0,
    arrivalOrder: 0,
    paymentStatus: "unpaid",
    paymentAmountDue: 150,
    paymentAmountPaid: 0,
    paymentMethod: "",
    paymentNotes: "",
    syncStatus: "local",
  };

  const queuedMatch: LocalQueuedMatch = {
    id: "queued-draft",
    sessionId: "session-1",
    queueLaneId: "lane-1",
    status: "draft",
    participants: [],
    sortOrder: 0,
    createdFrom: "manual",
  };

  return {
    sessionId: "session-1",
    sessionMode: "live",
    checkIns: [checkIn],
    queuedMatches: [queuedMatch],
    addPlayerToQueuedSlot: vi.fn().mockResolvedValue(undefined),
    movePlayerInQueuedSlot: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("resolvePegboardDrop", () => {
  describe("P1 player to queued slot", () => {
    it("accepts a waiting player into an empty draft slot", () => {
      const context = baseContext();
      const result = resolvePegboardDrop(playerDrag, emptySlot, context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        void result.run();
        expect(context.addPlayerToQueuedSlot).toHaveBeenCalledWith({
          queuedMatchId: "queued-draft",
          checkInId: "check-in-0",
          team: "team_one",
          slotOrder: 1,
        });
      }
    });

    it("accepts a resting player", () => {
      const context = baseContext({
        checkIns: [
          {
            ...baseContext().checkIns[0]!,
            queueStatus: "resting",
          },
        ],
      });
      const result = resolvePegboardDrop(playerDrag, emptySlot, context);
      expect(result.ok).toBe(true);
    });

    it("rejects ended session", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        emptySlot,
        baseContext({ sessionMode: "ended" }),
      );
      expect(result).toEqual({ ok: false, reason: "Session is read-only" });
    });

    it("rejects playing player", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        emptySlot,
        baseContext({
          checkIns: [
            {
              ...baseContext().checkIns[0]!,
              queueStatus: "playing",
            },
          ],
        }),
      );
      expect(result).toEqual({ ok: false, reason: "Player is on court" });
    });

    it("rejects assigned player", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        emptySlot,
        baseContext({
          checkIns: [
            {
              ...baseContext().checkIns[0]!,
              queueStatus: "assigned",
            },
          ],
        }),
      );
      expect(result).toEqual({ ok: false, reason: "Player is not available" });
    });

    it("rejects filled slot", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        emptySlot,
        baseContext({
          queuedMatches: [
            {
              ...baseContext().queuedMatches[0]!,
              participants: [
                {
                  checkInId: "check-in-9",
                  playerProfileId: "player-9",
                  team: "team_one",
                  slotOrder: 1,
                },
              ],
            },
          ],
        }),
      );
      expect(result).toEqual({ ok: false, reason: "Slot is already filled" });
    });

    it("rejects duplicate player in same match", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        { ...emptySlot, team: "team_two", slotOrder: 2 },
        baseContext({
          queuedMatches: [
            {
              ...baseContext().queuedMatches[0]!,
              participants: [
                {
                  checkInId: "check-in-0",
                  playerProfileId: "player-0",
                  team: "team_one",
                  slotOrder: 1,
                },
              ],
            },
          ],
        }),
      );
      expect(result).toEqual({ ok: false, reason: "Player is already in this match" });
    });

    it("rejects drop when match already has four players", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        emptySlot,
        baseContext({
          queuedMatches: [
            {
              ...baseContext().queuedMatches[0]!,
              participants: [
                { checkInId: "a", playerProfileId: "p-a", team: "team_one", slotOrder: 2 },
                { checkInId: "b", playerProfileId: "p-b", team: "team_two", slotOrder: 1 },
                { checkInId: "c", playerProfileId: "p-c", team: "team_two", slotOrder: 2 },
                { checkInId: "d", playerProfileId: "p-d", team: "team_one", slotOrder: 2 },
              ],
            },
          ],
        }),
      );
      expect(result).toEqual({ ok: false, reason: "Match is full" });
    });

    it("rejects promoted match", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        emptySlot,
        baseContext({
          queuedMatches: [
            {
              ...baseContext().queuedMatches[0]!,
              status: "promoted",
            },
          ],
        }),
      );
      expect(result).toEqual({ ok: false, reason: "Match cannot be edited" });
    });

    it("rejects missing player", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        emptySlot,
        baseContext({ checkIns: [] }),
      );
      expect(result).toEqual({ ok: false, reason: "Player not found" });
    });

    it("rejects missing match", () => {
      const result = resolvePegboardDrop(
        playerDrag,
        emptySlot,
        baseContext({ queuedMatches: [] }),
      );
      expect(result).toEqual({ ok: false, reason: "Match not found" });
    });
  });

  describe("P3 queued player between slots", () => {
    const queuedPlayerDrag = {
      kind: "queued-player" as const,
      sessionId: "session-1",
      queuedMatchId: "queued-draft",
      checkInId: "check-in-0",
      sourceZone: "next" as const,
    };

    const occupiedSlot = {
      kind: "queued-slot" as const,
      sessionId: "session-1",
      queuedMatchId: "queued-draft",
      team: "team_two" as const,
      slotOrder: 2 as const,
    };

    const matchWithPlayer = baseContext({
      queuedMatches: [
        {
          ...baseContext().queuedMatches[0]!,
          participants: [
            {
              checkInId: "check-in-0",
              playerProfileId: "player-0",
              team: "team_two",
              slotOrder: 1,
            },
          ],
        },
      ],
    });

    it("moves a player to an empty slot on the same match", () => {
      const context = matchWithPlayer;
      const result = resolvePegboardDrop(queuedPlayerDrag, emptySlot, context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        void result.run();
        expect(context.movePlayerInQueuedSlot).toHaveBeenCalledWith({
          queuedMatchId: "queued-draft",
          checkInId: "check-in-0",
          team: "team_one",
          slotOrder: 1,
        });
      }
    });

    it("swaps players when dropping on an occupied slot", () => {
      const context = baseContext({
        queuedMatches: [
          {
            ...baseContext().queuedMatches[0]!,
            participants: [
              {
                checkInId: "check-in-0",
                playerProfileId: "player-0",
                team: "team_two",
                slotOrder: 1,
              },
              {
                checkInId: "check-in-9",
                playerProfileId: "player-9",
                team: "team_two",
                slotOrder: 2,
              },
            ],
          },
        ],
      });

      const result = resolvePegboardDrop(queuedPlayerDrag, occupiedSlot, context);
      expect(result.ok).toBe(true);
      if (result.ok) {
        void result.run();
        expect(context.movePlayerInQueuedSlot).toHaveBeenCalledWith({
          queuedMatchId: "queued-draft",
          checkInId: "check-in-0",
          team: "team_two",
          slotOrder: 2,
        });
      }
    });

    it("rejects moving to the same slot", () => {
      const result = resolvePegboardDrop(
        queuedPlayerDrag,
        {
          kind: "queued-slot",
          sessionId: "session-1",
          queuedMatchId: "queued-draft",
          team: "team_two",
          slotOrder: 1,
        },
        matchWithPlayer,
      );
      expect(result).toEqual({ ok: false, reason: "Already in this slot" });
    });

    it("rejects moving across matches", () => {
      const result = resolvePegboardDrop(
        queuedPlayerDrag,
        { ...emptySlot, queuedMatchId: "other-match" },
        matchWithPlayer,
      );
      expect(result).toEqual({ ok: false, reason: "Move players within the same match only" });
    });
  });

  describe("unhandled paths", () => {
    it("returns not implemented for queued match to court", () => {
      const result = resolvePegboardDrop(
        {
          kind: "queued-match",
          sessionId: "session-1",
          queuedMatchId: "qm-1",
          sourceZone: "next",
        },
        {
          kind: "court",
          sessionId: "session-1",
          courtId: "court-1",
        },
        baseContext(),
      );
      expect(result).toEqual({ ok: false, reason: "Not implemented" });
    });

    it("returns invalid drop for unknown pair", () => {
      const result = resolvePegboardDrop(
        {
          kind: "queued-match",
          sessionId: "session-1",
          queuedMatchId: "qm-1",
          sourceZone: "next",
        },
        emptySlot,
        baseContext(),
      );
      expect(result).toEqual({ ok: false, reason: "Invalid drop" });
    });
  });

  describe("integration with Dexie", () => {
    beforeEach(async () => {
      await clearDatabase();
    });

    it("run updates queued match via updateQueuedMatchLocal", async () => {
      await createSessionLocal({
        id: "session-1",
        name: "Night",
        venueName: "Hall",
        startsAt: "2026-06-09T18:00:00.000Z",
        feeAmount: 150,
        courtCount: 2,
      });

      await checkInPlayerLocal({
        id: "check-in-0",
        sessionId: "session-1",
        playerProfileId: "player-0",
        playerDisplayName: "Player 0",
        arrivalOrder: 0,
        checkedInAt: "2026-06-09T18:00:00.000Z",
        sessionSkillRating: 3,
        paymentAmountDue: 150,
      });

      const lane = await db.queueLanes.where("sessionId").equals("session-1").first();
      await createQueuedMatchLocal({
        id: "queued-draft",
        sessionId: "session-1",
        queueLaneId: lane!.id,
        participants: [],
      });

      const checkIns = await db.checkIns.where("sessionId").equals("session-1").toArray();
      const queuedMatches = await db.queuedMatches.where("sessionId").equals("session-1").toArray();

      const addPlayerToQueuedSlot = async (input: {
        queuedMatchId: string;
        checkInId: string;
        team: "team_one" | "team_two";
        slotOrder: 1 | 2;
      }) => {
        const queuedMatch = await db.queuedMatches.get(input.queuedMatchId);
        const checkIn = await db.checkIns.get(input.checkInId);
        if (!queuedMatch || !checkIn) {
          throw new Error("Not found");
        }
        const participants = addPlayerToQueuedParticipants(queuedMatch.participants, {
          checkInId: input.checkInId,
          playerProfileId: checkIn.playerProfileId,
          team: input.team,
          slotOrder: input.slotOrder,
        });
        await updateQueuedMatchLocal({
          sessionId: "session-1",
          queuedMatchId: input.queuedMatchId,
          participants,
        });
      };

      const movePlayerInQueuedSlot = vi.fn().mockResolvedValue(undefined);

      const result = resolvePegboardDrop(playerDrag, emptySlot, {
        sessionId: "session-1",
        sessionMode: "live",
        checkIns,
        queuedMatches,
        addPlayerToQueuedSlot,
        movePlayerInQueuedSlot,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        await result.run();
      }

      const updated = await db.queuedMatches.get("queued-draft");
      expect(updated?.participants).toHaveLength(1);
      expect(updated?.participants[0]).toMatchObject({
        checkInId: "check-in-0",
        team: "team_one",
        slotOrder: 1,
      });

      const checkIn = await db.checkIns.get("check-in-0");
      expect(checkIn?.queueStatus).toBe("assigned");
    });
  });
});
