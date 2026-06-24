import type { LocalCheckIn, LocalQueuedMatch } from "../../../db/types.js";
import type { SessionMode } from "../../../components/domain/types.js";
import type { QueuedMatchSlotOrder, QueuedMatchTeam } from "../../../lib/queued-match-participants.js";
import { moveQueuedParticipantToSlot, participantAtSlot } from "../../../lib/queued-match-participants.js";
import type { DragItem, DropTarget } from "./drag-types.js";

export interface PegboardDropContext {
  sessionId: string;
  sessionMode: SessionMode;
  checkIns: LocalCheckIn[];
  queuedMatches: LocalQueuedMatch[];
  addPlayerToQueuedSlot: (input: {
    queuedMatchId: string;
    checkInId: string;
    team: QueuedMatchTeam;
    slotOrder: QueuedMatchSlotOrder;
  }) => Promise<void>;
  movePlayerInQueuedSlot: (input: {
    queuedMatchId: string;
    checkInId: string;
    team: QueuedMatchTeam;
    slotOrder: QueuedMatchSlotOrder;
  }) => Promise<void>;
}

export type ResolvePegboardDropResult =
  | { ok: true; run: () => Promise<void> }
  | { ok: false; reason: string };

export function resolvePegboardDrop(
  drag: DragItem,
  target: DropTarget,
  context: PegboardDropContext,
): ResolvePegboardDropResult {
  if (drag.kind === "player" && target.kind === "queued-slot") {
    return resolvePlayerToQueuedSlot(drag, target, context);
  }

  if (drag.kind === "queued-player" && target.kind === "queued-slot") {
    return resolveQueuedPlayerToSlot(drag, target, context);
  }

  if (drag.kind === "queued-match" && target.kind === "court") {
    return { ok: false, reason: "Not implemented" };
  }

  return { ok: false, reason: "Invalid drop" };
}

function resolvePlayerToQueuedSlot(
  drag: DragItem,
  target: DropTarget,
  context: PegboardDropContext,
): ResolvePegboardDropResult {
  if (context.sessionMode === "ended") {
    return { ok: false, reason: "Session is read-only" };
  }

  if (!drag.checkInId || !target.queuedMatchId || !target.team || !target.slotOrder) {
    return { ok: false, reason: "Invalid drop" };
  }

  const checkIn = context.checkIns.find((row) => row.id === drag.checkInId);
  if (!checkIn) {
    return { ok: false, reason: "Player not found" };
  }

  if (checkIn.queueStatus === "playing") {
    return { ok: false, reason: "Player is on court" };
  }

  if (checkIn.queueStatus !== "waiting" && checkIn.queueStatus !== "resting") {
    return { ok: false, reason: "Player is not available" };
  }

  const queuedMatch = context.queuedMatches.find((row) => row.id === target.queuedMatchId);
  if (!queuedMatch) {
    return { ok: false, reason: "Match not found" };
  }

  if (queuedMatch.status !== "draft" && queuedMatch.status !== "ready") {
    return { ok: false, reason: "Match cannot be edited" };
  }

  if (participantAtSlot(queuedMatch.participants, target.team, target.slotOrder)) {
    return { ok: false, reason: "Slot is already filled" };
  }

  if (queuedMatch.participants.some((participant) => participant.checkInId === drag.checkInId)) {
    return { ok: false, reason: "Player is already in this match" };
  }

  if (queuedMatch.participants.length >= 4) {
    return { ok: false, reason: "Match is full" };
  }

  return {
    ok: true,
    run: () =>
      context.addPlayerToQueuedSlot({
        queuedMatchId: target.queuedMatchId!,
        checkInId: drag.checkInId!,
        team: target.team!,
        slotOrder: target.slotOrder!,
      }),
  };
}

function resolveQueuedPlayerToSlot(
  drag: DragItem,
  target: DropTarget,
  context: PegboardDropContext,
): ResolvePegboardDropResult {
  if (context.sessionMode === "ended") {
    return { ok: false, reason: "Session is read-only" };
  }

  if (!drag.checkInId || !drag.queuedMatchId || !target.queuedMatchId || !target.team || !target.slotOrder) {
    return { ok: false, reason: "Invalid drop" };
  }

  if (drag.queuedMatchId !== target.queuedMatchId) {
    return { ok: false, reason: "Move players within the same match only" };
  }

  const queuedMatch = context.queuedMatches.find((row) => row.id === target.queuedMatchId);
  if (!queuedMatch) {
    return { ok: false, reason: "Match not found" };
  }

  if (queuedMatch.status !== "draft" && queuedMatch.status !== "ready") {
    return { ok: false, reason: "Match cannot be edited" };
  }

  const source = queuedMatch.participants.find((participant) => participant.checkInId === drag.checkInId);
  if (!source) {
    return { ok: false, reason: "Player is not in this match" };
  }

  if (source.team === target.team && source.slotOrder === target.slotOrder) {
    return { ok: false, reason: "Already in this slot" };
  }

  try {
    moveQueuedParticipantToSlot(queuedMatch.participants, {
      checkInId: drag.checkInId,
      team: target.team,
      slotOrder: target.slotOrder,
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Invalid drop",
    };
  }

  return {
    ok: true,
    run: () =>
      context.movePlayerInQueuedSlot({
        queuedMatchId: target.queuedMatchId!,
        checkInId: drag.checkInId!,
        team: target.team!,
        slotOrder: target.slotOrder!,
      }),
  };
}
