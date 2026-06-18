import { db } from "../db/database.js";
import type { LocalSession } from "../db/types.js";

export async function requireSession(sessionId: string): Promise<LocalSession> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found in local store.");
  }
  return session;
}

export async function nextArrivalOrder(sessionId: string): Promise<number> {
  const checkIns = await db.checkIns.where("sessionId").equals(sessionId).toArray();
  if (checkIns.length === 0) {
    return 0;
  }
  return Math.max(...checkIns.map((checkIn) => checkIn.arrivalOrder)) + 1;
}

export async function nextQueuedMatchSortOrder(
  sessionId: string,
  queueLaneId: string,
): Promise<number> {
  const queuedMatches = await db.queuedMatches
    .where({ sessionId, queueLaneId })
    .toArray();
  if (queuedMatches.length === 0) {
    return 0;
  }
  return Math.max(...queuedMatches.map((queuedMatch) => queuedMatch.sortOrder)) + 1;
}

export function activeCheckInStatuses(): string[] {
  return ["waiting", "assigned", "playing", "resting", "done"];
}

export async function findActiveCheckInForPlayer(
  sessionId: string,
  playerProfileId: string,
) {
  const checkIns = await db.checkIns
    .where({ sessionId, playerProfileId })
    .toArray();
  return checkIns.find((checkIn) => activeCheckInStatuses().includes(checkIn.queueStatus));
}
