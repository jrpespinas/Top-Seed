import Dexie, { type EntityTable } from "dexie";
import type {
  LocalCheckIn,
  LocalCourt,
  LocalMatch,
  LocalPlayerProfile,
  LocalQueueLane,
  LocalQueuedMatch,
  LocalSession,
  OutboxAction,
} from "./types.js";

/**
 * IndexedDB schema v1 — local-first session store + sync outbox.
 * Indexes: sessionId on check-ins, courts, lanes, queued matches, matches, outbox.
 */
export class TopSeedDatabase extends Dexie {
  sessions!: EntityTable<LocalSession, "id">;
  playerProfiles!: EntityTable<LocalPlayerProfile, "id">;
  checkIns!: EntityTable<LocalCheckIn, "id">;
  courts!: EntityTable<LocalCourt, "id">;
  queueLanes!: EntityTable<LocalQueueLane, "id">;
  queuedMatches!: EntityTable<LocalQueuedMatch, "id">;
  matches!: EntityTable<LocalMatch, "id">;
  syncOutbox!: EntityTable<OutboxAction, "id">;

  constructor(name = "top-seed") {
    super(name);

    this.version(1).stores({
      sessions: "id, organizationId, status",
      playerProfiles: "id, organizationId",
      checkIns: "id, sessionId, playerProfileId, syncStatus",
      courts: "id, sessionId",
      queueLanes: "id, sessionId",
      queuedMatches: "id, sessionId, queueLaneId",
      matches: "id, sessionId, courtId",
      syncOutbox: "id, sessionId, status, createdAt",
    });

    this.version(2).stores({
      sessions: "id, organizationId, status",
      playerProfiles: "id, organizationId",
      checkIns: "id, sessionId, playerProfileId, syncStatus",
      courts: "id, sessionId",
      queueLanes: "id, sessionId",
      queuedMatches: "id, sessionId, queueLaneId",
      matches: "id, sessionId, courtId",
      syncOutbox: "id, sessionId, status, createdAt",
    });
  }
}

export const db = new TopSeedDatabase();

export async function clearDatabase() {
  await Promise.all([
    db.sessions.clear(),
    db.playerProfiles.clear(),
    db.checkIns.clear(),
    db.courts.clear(),
    db.queueLanes.clear(),
    db.queuedMatches.clear(),
    db.matches.clear(),
    db.syncOutbox.clear(),
  ]);
}
