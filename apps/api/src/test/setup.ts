import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll } from "vitest";
import { prisma } from "../shared/infrastructure/prisma/client.js";

const envPath = resolve(process.cwd(), "../../.env");
if (existsSync(envPath) && !process.env.DATABASE_URL) {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^DATABASE_URL=(.+)$/);
    if (match) {
      process.env.DATABASE_URL = match[1]!.trim();
    }
  }
}

export const ORG_ID = "org-default";
export const DEVICE_ID = "test-device";

/** Set RUN_DB_TESTS=1 with Postgres running to execute integration tests. */
export const hasDatabase =
  process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

export async function resetDatabase() {
  await prisma.syncActionLog.deleteMany();
  await prisma.matchParticipant.deleteMany();
  await prisma.match.deleteMany();
  await prisma.queuedMatchParticipant.deleteMany();
  await prisma.queuedMatch.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.queueLane.deleteMany();
  await prisma.court.deleteMany();
  await prisma.session.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.organization.deleteMany();
}

export async function seedBaseFixtures() {
  await prisma.organization.create({
    data: { id: ORG_ID, name: "Test Club", timezone: "Asia/Manila" },
  });

  const players = ["player-ana", "player-ben", "player-cara", "player-dan"] as const;
  for (const id of players) {
    await prisma.playerProfile.create({
      data: {
        id,
        organizationId: ORG_ID,
        displayName: id.replace("player-", "").toUpperCase(),
      },
    });
  }

  const sessionId = "session-friday";
  await prisma.session.create({
    data: {
      id: sessionId,
      organizationId: ORG_ID,
      name: "Friday Open Play",
      venueName: "Main Hall",
      startsAt: new Date("2026-06-09T18:00:00.000Z"),
      status: "active",
      feeAmount: 250,
      queueMode: "suggested",
      ratingMode: "casual",
    },
  });

  const laneId = "lane-queue-1";
  await prisma.queueLane.create({
    data: { id: laneId, sessionId, name: "Next", sortOrder: 0 },
  });

  const courtId = "court-1";
  await prisma.court.create({
    data: { id: courtId, sessionId, name: "Court 1", sortOrder: 0 },
  });

  const checkIns = [
    { id: "ci-ana", playerProfileId: "player-ana", arrivalOrder: 1 },
    { id: "ci-ben", playerProfileId: "player-ben", arrivalOrder: 2 },
    { id: "ci-cara", playerProfileId: "player-cara", arrivalOrder: 3 },
    { id: "ci-dan", playerProfileId: "player-dan", arrivalOrder: 4 },
  ];

  for (const checkIn of checkIns) {
    await prisma.checkIn.create({
      data: {
        id: checkIn.id,
        sessionId,
        playerProfileId: checkIn.playerProfileId,
        arrivalOrder: checkIn.arrivalOrder,
        checkedInAt: new Date("2026-06-09T18:05:00.000Z"),
        queueStatus: "waiting",
        sessionSkillRating: 3,
        paymentAmountDue: 250,
      },
    });
  }

  return { sessionId, laneId, courtId, checkIns };
}

afterAll(async () => {
  await prisma.$disconnect();
});
