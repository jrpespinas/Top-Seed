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

describe.skipIf(!hasDatabase)("walk-in golden chain", () => {
  it("replays CREATE_PLAYER_PROFILE → CHECK_IN_PLAYER idempotently", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const actions = [
      {
        id: "sync-create-bogs",
        type: "CREATE_PLAYER_PROFILE",
        entityType: "playerProfile",
        entityId: "player-bogs",
        createdAt: "2026-06-09T18:00:00.000Z",
        payload: {
          organizationId: ORG_ID,
          displayName: "Bogs",
          defaultSkillRating: 3,
        },
      },
      {
        id: "sync-checkin-bogs",
        type: "CHECK_IN_PLAYER",
        entityType: "checkIn",
        entityId: "ci-bogs",
        sessionId,
        createdAt: "2026-06-09T18:01:00.000Z",
        payload: {
          sessionId,
          playerProfileId: "player-bogs",
          arrivalOrder: 5,
          checkedInAt: "2026-06-09T18:01:00.000Z",
          sessionSkillRating: 3,
          paymentAmountDue: 250,
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
    expect(firstBody.results).toHaveLength(2);
    expect(firstBody.results.every((r: { status: string }) => r.status === "applied")).toBe(true);

    const profile = await prisma.playerProfile.findUnique({ where: { id: "player-bogs" } });
    expect(profile?.displayName).toBe("Bogs");

    const checkIn = await prisma.checkIn.findUnique({ where: { id: "ci-bogs" } });
    expect(checkIn?.playerProfileId).toBe("player-bogs");

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: { organizationId: ORG_ID, deviceId: DEVICE_ID, actions },
    });
    const secondBody = JSON.parse(second.body);
    expect(secondBody.results.every((r: { status: string }) => r.status === "already_applied")).toBe(
      true,
    );
  });

  it("applies duplicate CHECK_IN_PLAYER with a new action id when check-in already exists", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const checkInAction = {
      id: "sync-checkin-bogs",
      type: "CHECK_IN_PLAYER",
      entityType: "checkIn",
      entityId: "ci-bogs",
      sessionId,
      createdAt: "2026-06-09T18:01:00.000Z",
      payload: {
        sessionId,
        playerProfileId: "player-bogs",
        arrivalOrder: 5,
        checkedInAt: "2026-06-09T18:01:00.000Z",
        sessionSkillRating: 3,
        paymentAmountDue: 250,
      },
    };

    await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-create-bogs",
            type: "CREATE_PLAYER_PROFILE",
            entityType: "playerProfile",
            entityId: "player-bogs",
            createdAt: "2026-06-09T18:00:00.000Z",
            payload: {
              organizationId: ORG_ID,
              displayName: "Bogs",
              defaultSkillRating: 3,
            },
          },
          checkInAction,
        ],
      },
    });

    const retry = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: "device-bootstrap-retry",
        actions: [
          {
            ...checkInAction,
            id: "bootstrap-checkin-bogs",
          },
        ],
      },
    });
    expect(retry.statusCode).toBe(200);
    const retryBody = JSON.parse(retry.body);
    expect(retryBody.results[0]?.status).toBe("applied");
  });

  it("accepts legacy CREATE_PLAYER alias", async () => {
    await resetDatabase();
    await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: "legacy-device",
        actions: [
          {
            id: "sync-legacy-player",
            type: "CREATE_PLAYER",
            entityType: "playerProfile",
            entityId: "player-legacy",
            createdAt: "2026-06-09T18:00:00.000Z",
            payload: {
              organizationId: ORG_ID,
              displayName: "Legacy",
              defaultSkillRating: 3,
            },
          },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    const profile = await prisma.playerProfile.findUnique({ where: { id: "player-legacy" } });
    expect(profile?.displayName).toBe("Legacy");
  });

  it("fails CHECK_IN_PLAYER when profile is missing", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: "missing-profile-device",
        actions: [
          {
            id: "sync-missing-profile",
            type: "CHECK_IN_PLAYER",
            entityType: "checkIn",
            entityId: "ci-missing",
            sessionId,
            createdAt: "2026-06-09T18:01:00.000Z",
            payload: {
              sessionId,
              playerProfileId: "player-unknown",
              arrivalOrder: 5,
              checkedInAt: "2026-06-09T18:01:00.000Z",
              sessionSkillRating: 3,
            },
          },
        ],
      },
    });
    const body = JSON.parse(response.body);
    expect(body.results[0]?.status).toBe("failed");
    expect(body.results[0]?.errorCode).toBe("PLAYER_NOT_FOUND");
  });
});

describe.skipIf(!hasDatabase)("phase 7 sync actions", () => {
  it("replays UPDATE_PAYMENT", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: "payment-device",
        actions: [
          {
            id: "sync-payment-ana",
            type: "UPDATE_PAYMENT",
            entityType: "checkIn",
            entityId: "ci-ana",
            sessionId,
            createdAt: "2026-06-09T19:00:00.000Z",
            payload: {
              paymentStatus: "paid",
              paymentAmountDue: 250,
              paymentAmountPaid: 250,
              paymentMethod: "cash",
              paymentNotes: "",
              updatedAt: "2026-06-09T19:00:00.000Z",
            },
          },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    const checkIn = await prisma.checkIn.findUnique({ where: { id: "ci-ana" } });
    expect(checkIn?.paymentStatus).toBe("paid");
    expect(checkIn?.paymentAmountPaid).toBe(250);
  });

  it("replays UPDATE_CHECK_IN resting transition", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: "checkin-update-device",
        actions: [
          {
            id: "sync-rest-ana",
            type: "UPDATE_CHECK_IN",
            entityType: "checkIn",
            entityId: "ci-ana",
            sessionId,
            createdAt: "2026-06-09T19:00:00.000Z",
            payload: { queueStatus: "resting" },
          },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    const checkIn = await prisma.checkIn.findUnique({ where: { id: "ci-ana" } });
    expect(checkIn?.queueStatus).toBe("resting");
  });

  it("replays UPDATE_PLAYER_PROFILE", async () => {
    await resetDatabase();
    await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: "profile-device",
        actions: [
          {
            id: "sync-profile-ana",
            type: "UPDATE_PLAYER_PROFILE",
            entityType: "playerProfile",
            entityId: "player-ana",
            createdAt: "2026-06-09T19:00:00.000Z",
            payload: {
              displayName: "Ana Updated",
              defaultSkillRating: 4,
            },
          },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    const profile = await prisma.playerProfile.findUnique({ where: { id: "player-ana" } });
    expect(profile?.displayName).toBe("Ana Updated");
    expect(profile?.defaultSkillRating).toBe(4);
  });

  it("replays CREATE_QUEUE_LANE for organizer-added lanes", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-create-lane-2",
            type: "CREATE_QUEUE_LANE",
            entityType: "queueLane",
            entityId: "lane-queue-2",
            sessionId,
            createdAt: "2026-06-09T18:05:00.000Z",
            payload: {
              sessionId,
              name: "Priority",
              sortOrder: 1,
            },
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.results[0]?.status).toBe("applied");

    const lane = await prisma.queueLane.findUnique({ where: { id: "lane-queue-2" } });
    expect(lane?.name).toBe("Priority");
    expect(lane?.sortOrder).toBe(1);
  });

  it("replays REMOVE_QUEUED_MATCH and releases players to waiting", async () => {
    await resetDatabase();
    const { sessionId, laneId } = await seedBaseFixtures();
    const app = await buildApp();

    await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-create-qm",
            type: "CREATE_QUEUED_MATCH",
            entityType: "queuedMatch",
            entityId: "qm-1",
            sessionId,
            createdAt: "2026-06-09T18:10:00.000Z",
            payload: {
              sessionId,
              queueLaneId: laneId,
              sortOrder: 0,
              status: "draft",
              createdFrom: "manual",
              participants: [
                {
                  playerProfileId: "player-ana",
                  checkInId: "ci-ana",
                  team: "team_one",
                  slotOrder: 1,
                },
              ],
            },
          },
        ],
      },
    });

    const removeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-remove-qm",
            type: "REMOVE_QUEUED_MATCH",
            entityType: "queuedMatch",
            entityId: "qm-1",
            sessionId,
            createdAt: "2026-06-09T18:11:00.000Z",
            payload: {},
          },
        ],
      },
    });

    expect(removeResponse.statusCode).toBe(200);
    const body = JSON.parse(removeResponse.body);
    expect(body.results[0]?.status).toBe("applied");

    const queuedMatch = await prisma.queuedMatch.findUnique({ where: { id: "qm-1" } });
    expect(queuedMatch?.status).toBe("removed");

    const checkIn = await prisma.checkIn.findUnique({ where: { id: "ci-ana" } });
    expect(checkIn?.queueStatus).toBe("waiting");
  });

  it("replays CREATE_COURT and DELETE_COURT", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-create-court-4",
            type: "CREATE_COURT",
            entityType: "court",
            entityId: "court-4",
            sessionId,
            createdAt: "2026-06-09T18:12:00.000Z",
            payload: {
              sessionId,
              name: "Court 4",
              sortOrder: 3,
              status: "open",
            },
          },
        ],
      },
    });
    expect(createResponse.statusCode).toBe(200);
    expect(JSON.parse(createResponse.body).results[0]?.status).toBe("applied");

    const deleteResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-delete-court-4",
            type: "DELETE_COURT",
            entityType: "court",
            entityId: "court-4",
            sessionId,
            createdAt: "2026-06-09T18:13:00.000Z",
            payload: {},
          },
        ],
      },
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(JSON.parse(deleteResponse.body).results[0]?.status).toBe("applied");

    const court = await prisma.court.findUnique({ where: { id: "court-4" } });
    expect(court).toBeNull();
  });

  it("fails DELETE_COURT with a clear error when the court has match history", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    await prisma.court.create({
      data: { id: "court-2", sessionId, name: "Court 2", sortOrder: 1 },
    });
    await prisma.match.create({
      data: {
        id: "match-on-court-1",
        sessionId,
        courtId: "court-1",
        status: "completed",
        outcome: "team_one_win",
        winningTeam: "team_one",
      },
    });
    const app = await buildApp();

    const deleteResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-delete-court-with-history",
            type: "DELETE_COURT",
            entityType: "court",
            entityId: "court-1",
            sessionId,
            createdAt: "2026-06-09T18:13:00.000Z",
            payload: {},
          },
        ],
      },
    });

    expect(deleteResponse.statusCode).toBe(200);
    const body = JSON.parse(deleteResponse.body);
    expect(body.results[0]?.status).toBe("failed");
    expect(body.results[0]?.message).toMatch(/match history/i);

    const court = await prisma.court.findUnique({ where: { id: "court-1" } });
    expect(court).not.toBeNull();
  });

  it("replays UPDATE_COURT by creating the court when it is missing on the server", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-update-missing-court",
            type: "UPDATE_COURT",
            entityType: "court",
            entityId: "court-2",
            sessionId,
            createdAt: "2026-06-09T18:14:00.000Z",
            payload: {
              name: "Court 2",
              sortOrder: 1,
              status: "open",
            },
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.results[0]?.status).toBe("applied");

    const court = await prisma.court.findUnique({ where: { id: "court-2" } });
    expect(court?.name).toBe("Court 2");
    expect(court?.sortOrder).toBe(1);
  });

  it("replays UPDATE_COURT with only a name by upserting the missing court", async () => {
    await resetDatabase();
    const { sessionId } = await seedBaseFixtures();
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: {
        organizationId: ORG_ID,
        deviceId: DEVICE_ID,
        actions: [
          {
            id: "sync-update-missing-court-name-only",
            type: "UPDATE_COURT",
            entityType: "court",
            entityId: "court-2",
            sessionId,
            createdAt: "2026-06-09T18:15:00.000Z",
            payload: {
              name: "Court 2",
            },
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.results[0]?.status).toBe("applied");

    const court = await prisma.court.findUnique({ where: { id: "court-2" } });
    expect(court?.name).toBe("Court 2");
  });
});
