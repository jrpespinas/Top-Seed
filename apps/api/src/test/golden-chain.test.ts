import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import {
  DEVICE_ID,
  ORG_ID,
  hasDatabase,
  resetDatabase,
  seedBaseFixtures,
} from "../test/setup.js";
import { prisma } from "../shared/infrastructure/prisma/client.js";

describe.skipIf(!hasDatabase)("golden chain integration", () => {
  it("replays CREATE_QUEUED_MATCH → MOVE → START → COMPLETE idempotently", async () => {
    await resetDatabase();
    const { sessionId, laneId, courtId } = await seedBaseFixtures();
    const app = await buildApp();

    const actions = [
      {
        id: "sync-001-create-queued-match",
        type: "CREATE_QUEUED_MATCH",
        entityType: "queuedMatch",
        entityId: "qm-suggest-001",
        sessionId,
        createdAt: "2026-06-09T14:30:00.000Z",
        payload: {
          sessionId,
          queueLaneId: laneId,
          sortOrder: 0,
          status: "ready",
          createdFrom: "suggestion",
          participants: [
            { playerProfileId: "player-ana", checkInId: "ci-ana", team: "team_one", slotOrder: 1 },
            { playerProfileId: "player-ben", checkInId: "ci-ben", team: "team_one", slotOrder: 2 },
            { playerProfileId: "player-cara", checkInId: "ci-cara", team: "team_two", slotOrder: 1 },
            { playerProfileId: "player-dan", checkInId: "ci-dan", team: "team_two", slotOrder: 2 },
          ],
        },
      },
      {
        id: "sync-010-promote",
        type: "MOVE_QUEUED_MATCH_TO_COURT",
        entityType: "queuedMatch",
        entityId: "qm-suggest-001",
        sessionId,
        createdAt: "2026-06-09T14:35:00.000Z",
        payload: {
          courtId,
          matchId: "match-promoted-001",
          assignedAt: "2026-06-09T14:35:00.000Z",
        },
      },
      {
        id: "sync-015-start",
        type: "START_MATCH",
        entityType: "match",
        entityId: "match-promoted-001",
        sessionId,
        createdAt: "2026-06-09T14:40:00.000Z",
        payload: { startedAt: "2026-06-09T14:40:00.000Z" },
      },
      {
        id: "sync-020-complete",
        type: "COMPLETE_MATCH",
        entityType: "match",
        entityId: "match-promoted-001",
        sessionId,
        createdAt: "2026-06-09T14:50:00.000Z",
        payload: {
          outcome: "team_one_win",
          teamOneScore: 21,
          teamTwoScore: 18,
          winningTeam: "team_one",
          endedAt: "2026-06-09T14:50:00.000Z",
        },
      },
    ];

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: { organizationId: ORG_ID, deviceId: DEVICE_ID, actions },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = JSON.parse(first.body);
    expect(firstBody.results).toHaveLength(4);
    expect(firstBody.results.every((r: { status: string }) => r.status === "applied")).toBe(true);

    const match = await prisma.match.findUnique({ where: { id: "match-promoted-001" } });
    expect(match?.status).toBe("completed");
    expect(match?.outcome).toBe("team_one_win");

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: { organizationId: ORG_ID, deviceId: DEVICE_ID, actions },
    });
    const secondBody = JSON.parse(second.body);
    expect(secondBody.results.every((r: { status: string }) => r.status === "already_applied")).toBe(
      true,
    );

    const matchCount = await prisma.match.count({ where: { id: "match-promoted-001" } });
    expect(matchCount).toBe(1);
  });
});

describe.skipIf(!hasDatabase)("check-in paths", () => {
  it("direct POST and sync CHECK_IN_PLAYER share the same outcome", async () => {
    await resetDatabase();
    await seedBaseFixtures();
    const app = await buildApp();

    await prisma.checkIn.deleteMany({ where: { id: "ci-ana" } });

    const direct = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/session-friday/check-ins",
      payload: {
        id: "ci-ana",
        playerProfileId: "player-ana",
        arrivalOrder: 1,
        checkedInAt: "2026-06-09T18:10:00.000Z",
        sessionSkillRating: 3.5,
      },
    });
    expect(direct.statusCode).toBe(200);

    await prisma.checkIn.deleteMany({ where: { id: "ci-ben" } });
    const sync = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: "device-sync-checkin",
        actions: [
          {
            id: "sync-checkin-ben",
            type: "CHECK_IN_PLAYER",
            entityType: "checkIn",
            entityId: "ci-ben",
            sessionId: "session-friday",
            createdAt: "2026-06-09T18:10:00.000Z",
            payload: {
              sessionId: "session-friday",
              playerProfileId: "player-ben",
              arrivalOrder: 2,
              checkedInAt: "2026-06-09T18:10:00.000Z",
              sessionSkillRating: 3.5,
            },
          },
        ],
      },
    });
    expect(sync.statusCode).toBe(200);

    const ben = await prisma.checkIn.findUnique({ where: { id: "ci-ben" } });
    expect(ben?.queueStatus).toBe("waiting");
    expect(ben?.sessionSkillRating).toBe(3.5);
  });
});

describe.skipIf(!hasDatabase)("HTTP errors with database", () => {
  it("returns error envelope when promoting incomplete queued match", async () => {
    await resetDatabase();
    const { sessionId, laneId, courtId } = await seedBaseFixtures();
    const app = await buildApp();

    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/queue/lanes/${laneId}/queued-matches`,
      payload: {
        id: "qm-draft",
        sortOrder: 0,
        createdFrom: "manual",
        participants: [
          { playerProfileId: "player-ana", checkInId: "ci-ana", team: "team_one", slotOrder: 1 },
        ],
      },
    });

    const promote = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/queue/queued-matches/qm-draft/move-to-court`,
      payload: {
        courtId,
        matchId: "match-1",
        assignedAt: "2026-06-09T14:35:00.000Z",
      },
    });
    expect(promote.statusCode).toBe(409);
    const body = JSON.parse(promote.body);
    expect(body.error.code).toBe("QUEUED_MATCH_NOT_READY");
  });
});

describe.skipIf(!hasDatabase)("dashboard with database", () => {
  it("returns data envelope", async () => {
    await resetDatabase();
    await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sessions/session-friday/dashboard",
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.session.id).toBe("session-friday");
    expect(body.data.checkIns).toHaveLength(4);
    expect(body.meta.serverTime).toBeTruthy();
  });
});
