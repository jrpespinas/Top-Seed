import { db } from "../db/database.js";
import { DEFAULT_ORG_ID } from "./device.js";

export const DEV_SESSION_ID = "session-dev-local";

const DEV_PLAYERS = [
  { id: "player-dev-1", displayName: "Alex Chen", defaultSkillRating: 1200 },
  { id: "player-dev-2", displayName: "Jordan Lee", defaultSkillRating: 1150 },
  { id: "player-dev-3", displayName: "Sam Rivera", defaultSkillRating: 1100 },
] as const;

export async function ensureDevSessionSeeded() {
  const existing = await db.sessions.get(DEV_SESSION_ID);
  if (existing) {
    return existing;
  }

  const session = {
    id: DEV_SESSION_ID,
    organizationId: DEFAULT_ORG_ID,
    name: "Tuesday Open Play",
    venueName: "Court 1–4",
    startsAt: new Date().toISOString(),
    status: "active",
    feeAmount: 150,
    currency: "PHP",
    queueMode: "suggested" as const,
    ratingMode: "casual" as const,
  };

  await db.transaction("rw", [db.sessions, db.playerProfiles], async () => {
    await db.sessions.put(session);
    for (const player of DEV_PLAYERS) {
      await db.playerProfiles.put({
        id: player.id,
        organizationId: DEFAULT_ORG_ID,
        displayName: player.displayName,
        defaultSkillRating: player.defaultSkillRating,
      });
    }
  });

  return session;
}

export async function listDevPlayers() {
  return db.playerProfiles.toArray();
}
