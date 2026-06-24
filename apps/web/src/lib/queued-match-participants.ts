import type { LocalQueuedMatchParticipant } from "../db/types.js";

export type QueuedMatchTeam = LocalQueuedMatchParticipant["team"];
export type QueuedMatchSlotOrder = LocalQueuedMatchParticipant["slotOrder"];

export function participantAtSlot(
  participants: LocalQueuedMatchParticipant[],
  team: QueuedMatchTeam,
  slotOrder: QueuedMatchSlotOrder,
): LocalQueuedMatchParticipant | undefined {
  return participants.find((p) => p.team === team && p.slotOrder === slotOrder);
}

export function addPlayerToQueuedParticipants(
  participants: LocalQueuedMatchParticipant[],
  input: {
    checkInId: string;
    playerProfileId: string;
    team: QueuedMatchTeam;
    slotOrder: QueuedMatchSlotOrder;
  },
): LocalQueuedMatchParticipant[] {
  if (participantAtSlot(participants, input.team, input.slotOrder)) {
    throw new Error("Slot is already filled.");
  }
  if (participants.some((p) => p.checkInId === input.checkInId)) {
    throw new Error("Player is already in this match.");
  }
  if (participants.length >= 4) {
    throw new Error("Match is full.");
  }

  return [
    ...participants,
    {
      checkInId: input.checkInId,
      playerProfileId: input.playerProfileId,
      team: input.team,
      slotOrder: input.slotOrder,
    },
  ];
}

export function removePlayerFromQueuedParticipants(
  participants: LocalQueuedMatchParticipant[],
  checkInId: string,
): LocalQueuedMatchParticipant[] {
  const next = participants.filter((p) => p.checkInId !== checkInId);
  if (next.length === participants.length) {
    throw new Error("Player is not in this match.");
  }
  return next;
}

export function moveQueuedParticipantToSlot(
  participants: LocalQueuedMatchParticipant[],
  input: {
    checkInId: string;
    team: QueuedMatchTeam;
    slotOrder: QueuedMatchSlotOrder;
  },
): LocalQueuedMatchParticipant[] {
  const source = participants.find((participant) => participant.checkInId === input.checkInId);
  if (!source) {
    throw new Error("Player is not in this match.");
  }

  if (source.team === input.team && source.slotOrder === input.slotOrder) {
    throw new Error("Already in this slot.");
  }

  const target = participantAtSlot(participants, input.team, input.slotOrder);

  if (!target) {
    return participants.map((participant) =>
      participant.checkInId === input.checkInId
        ? { ...participant, team: input.team, slotOrder: input.slotOrder }
        : participant,
    );
  }

  return participants.map((participant) => {
    if (participant.checkInId === input.checkInId) {
      return { ...participant, team: target.team, slotOrder: target.slotOrder };
    }
    if (participant.checkInId === target.checkInId) {
      return { ...participant, team: source.team, slotOrder: source.slotOrder };
    }
    return participant;
  });
}
