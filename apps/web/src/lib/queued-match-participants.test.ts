import { describe, expect, it } from "vitest";
import {
  addPlayerToQueuedParticipants,
  moveQueuedParticipantToSlot,
  participantAtSlot,
  removePlayerFromQueuedParticipants,
} from "./queued-match-participants.js";

const baseParticipant = {
  checkInId: "check-in-1",
  playerProfileId: "player-1",
  team: "team_one" as const,
  slotOrder: 1 as const,
};

describe("queued-match-participants", () => {
  it("adds a player to an empty slot with correct shape", () => {
    const next = addPlayerToQueuedParticipants([], {
      checkInId: "check-in-1",
      playerProfileId: "player-1",
      team: "team_one",
      slotOrder: 1,
    });
    expect(next).toEqual([baseParticipant]);
    expect(participantAtSlot(next, "team_one", 1)).toEqual(baseParticipant);
  });

  it("fills four slots across teams", () => {
    let participants = addPlayerToQueuedParticipants([], {
      checkInId: "c1",
      playerProfileId: "p1",
      team: "team_one",
      slotOrder: 1,
    });
    participants = addPlayerToQueuedParticipants(participants, {
      checkInId: "c2",
      playerProfileId: "p2",
      team: "team_one",
      slotOrder: 2,
    });
    participants = addPlayerToQueuedParticipants(participants, {
      checkInId: "c3",
      playerProfileId: "p3",
      team: "team_two",
      slotOrder: 1,
    });
    participants = addPlayerToQueuedParticipants(participants, {
      checkInId: "c4",
      playerProfileId: "p4",
      team: "team_two",
      slotOrder: 2,
    });
    expect(participants).toHaveLength(4);
  });

  it("rejects duplicate player in same match", () => {
    const participants = [baseParticipant];
    expect(() =>
      addPlayerToQueuedParticipants(participants, {
        checkInId: "check-in-1",
        playerProfileId: "player-1",
        team: "team_two",
        slotOrder: 1,
      }),
    ).toThrow("Player is already in this match.");
  });

  it("rejects filled slot", () => {
    expect(() =>
      addPlayerToQueuedParticipants([baseParticipant], {
        checkInId: "check-in-2",
        playerProfileId: "player-2",
        team: "team_one",
        slotOrder: 1,
      }),
    ).toThrow("Slot is already filled.");
  });

  it("removes a player from participants", () => {
    const next = removePlayerFromQueuedParticipants(
      [
        baseParticipant,
        {
          checkInId: "check-in-2",
          playerProfileId: "player-2",
          team: "team_two",
          slotOrder: 1,
        },
      ],
      "check-in-1",
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.checkInId).toBe("check-in-2");
  });

  it("moves a player to an empty slot", () => {
    const participants = [
      baseParticipant,
      {
        checkInId: "check-in-2",
        playerProfileId: "player-2",
        team: "team_two",
        slotOrder: 1,
      },
    ];
    const next = moveQueuedParticipantToSlot(participants, {
      checkInId: "check-in-1",
      team: "team_two",
      slotOrder: 2,
    });
    expect(participantAtSlot(next, "team_two", 2)?.checkInId).toBe("check-in-1");
    expect(participantAtSlot(next, "team_one", 1)).toBeUndefined();
  });

  it("swaps players when target slot is occupied", () => {
    const participants = [
      baseParticipant,
      {
        checkInId: "check-in-2",
        playerProfileId: "player-2",
        team: "team_two",
        slotOrder: 1,
      },
    ];
    const next = moveQueuedParticipantToSlot(participants, {
      checkInId: "check-in-1",
      team: "team_two",
      slotOrder: 1,
    });
    expect(participantAtSlot(next, "team_two", 1)?.checkInId).toBe("check-in-1");
    expect(participantAtSlot(next, "team_one", 1)?.checkInId).toBe("check-in-2");
  });
});
