import type { QueuedMatchSlotOrder, QueuedMatchTeam } from "../../../lib/queued-match-participants.js";

export type DragKind = "player" | "queued-match" | "queued-player";
export type DropKind = "queued-slot" | "court" | "court-slot";
export type SourceZone = "available" | "next" | "court";

export interface DragItem {
  kind: DragKind;
  sessionId: string;
  checkInId?: string;
  queuedMatchId?: string;
  playerProfileId?: string;
  sourceZone: SourceZone;
}

export interface DropTarget {
  kind: DropKind;
  sessionId: string;
  queuedMatchId?: string;
  courtId?: string;
  team?: QueuedMatchTeam;
  slotOrder?: QueuedMatchSlotOrder;
}

export function playerDragId(checkInId: string): string {
  return `player:${checkInId}`;
}

export function queuedMatchDragId(queuedMatchId: string): string {
  return `queued-match:${queuedMatchId}`;
}

export function queuedPlayerDragId(queuedMatchId: string, checkInId: string): string {
  return `queued-player:${queuedMatchId}:${checkInId}`;
}

export function queuedSlotDropId(
  queuedMatchId: string,
  team: QueuedMatchTeam,
  slotOrder: QueuedMatchSlotOrder,
): string {
  return `slot:qm:${queuedMatchId}:${team}:${slotOrder}`;
}

export function courtDropId(courtId: string): string {
  return `court:${courtId}`;
}

export function courtSlotDropId(
  courtId: string,
  team: QueuedMatchTeam,
  slotOrder: QueuedMatchSlotOrder,
): string {
  return `slot:court:${courtId}:${team}:${slotOrder}`;
}

export function parseDragId(id: string, sessionId: string): DragItem | null {
  if (id.startsWith("player:")) {
    const checkInId = id.slice("player:".length);
    if (!checkInId) {
      return null;
    }
    return { kind: "player", sessionId, checkInId, sourceZone: "available" };
  }
  if (id.startsWith("queued-match:")) {
    const queuedMatchId = id.slice("queued-match:".length);
    if (!queuedMatchId) {
      return null;
    }
    return { kind: "queued-match", sessionId, queuedMatchId, sourceZone: "next" };
  }
  if (id.startsWith("queued-player:")) {
    const parts = id.slice("queued-player:".length).split(":");
    const [queuedMatchId, checkInId] = parts;
    if (!queuedMatchId || !checkInId) {
      return null;
    }
    return {
      kind: "queued-player",
      sessionId,
      queuedMatchId,
      checkInId,
      sourceZone: "next",
    };
  }
  return null;
}

export function parseDropId(id: string, sessionId: string): DropTarget | null {
  if (id.startsWith("slot:qm:")) {
    const parts = id.slice("slot:qm:".length).split(":");
    const [queuedMatchId, team, slotOrderRaw] = parts;
    if (!queuedMatchId || (team !== "team_one" && team !== "team_two")) {
      return null;
    }
    const slotOrder = slotOrderRaw === "1" ? 1 : slotOrderRaw === "2" ? 2 : null;
    if (!slotOrder) {
      return null;
    }
    return {
      kind: "queued-slot",
      sessionId,
      queuedMatchId,
      team,
      slotOrder,
    };
  }
  if (id.startsWith("court:")) {
    const courtId = id.slice("court:".length);
    if (!courtId || courtId.includes(":")) {
      return null;
    }
    return { kind: "court", sessionId, courtId };
  }
  if (id.startsWith("slot:court:")) {
    const parts = id.slice("slot:court:".length).split(":");
    const [courtId, team, slotOrderRaw] = parts;
    if (!courtId || (team !== "team_one" && team !== "team_two")) {
      return null;
    }
    const slotOrder = slotOrderRaw === "1" ? 1 : slotOrderRaw === "2" ? 2 : null;
    if (!slotOrder) {
      return null;
    }
    return {
      kind: "court-slot",
      sessionId,
      courtId,
      team,
      slotOrder,
    };
  }
  return null;
}
