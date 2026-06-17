import { afterEach, describe, expect, it, vi } from "vitest";
import { outboxToSyncRequest, postSyncActions } from "../sync/syncClient.js";
import type { OutboxAction } from "../db/types.js";

describe("syncClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps outbox rows to sync request actions", () => {
    const actions: OutboxAction[] = [
      {
        id: "action-1",
        organizationId: "org-default",
        type: "CHECK_IN_PLAYER",
        entityType: "checkIn",
        entityId: "check-in-1",
        sessionId: "session-1",
        payload: { sessionId: "session-1" },
        createdAt: "2026-06-09T10:00:00.000Z",
        status: "pending",
      },
    ];

    const request = outboxToSyncRequest("org-default", "device-1", actions);
    expect(request.organizationId).toBe("org-default");
    expect(request.deviceId).toBe("device-1");
    expect(request.actions[0]?.id).toBe("action-1");
    expect(request.actions[0]?.type).toBe("CHECK_IN_PLAYER");
  });

  it("parses a successful sync response envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          organizationId: "org-default",
          deviceId: "device-1",
          processedAt: "2026-06-09T10:01:00.000Z",
          results: [
            {
              actionId: "action-1",
              status: "applied",
              entityType: "checkIn",
              entityId: "check-in-1",
              serverUpdatedAt: "2026-06-09T10:01:00.000Z",
            },
          ],
        }),
      }),
    );

    const response = await postSyncActions({
      organizationId: "org-default",
      deviceId: "device-1",
      actions: [
        {
          id: "action-1",
          type: "CHECK_IN_PLAYER",
          entityType: "checkIn",
          entityId: "check-in-1",
          sessionId: "session-1",
          payload: { sessionId: "session-1" },
          createdAt: "2026-06-09T10:00:00.000Z",
        },
      ],
    });

    expect(response.results[0]?.status).toBe("applied");
  });

  it("throws when API returns an error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: "Invalid sync batch" },
        }),
      }),
    );

    await expect(
      postSyncActions({
        organizationId: "org-default",
        deviceId: "device-1",
        actions: [
          {
            id: "action-1",
            type: "CHECK_IN_PLAYER",
            entityType: "checkIn",
            entityId: "check-in-1",
            sessionId: "session-1",
            payload: {},
            createdAt: "2026-06-09T10:00:00.000Z",
          },
        ],
      }),
    ).rejects.toThrow("Invalid sync batch");
  });
});
