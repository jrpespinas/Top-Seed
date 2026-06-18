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
});
