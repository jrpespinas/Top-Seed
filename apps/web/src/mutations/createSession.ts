import { z } from "zod";
import {
  createSessionPayloadSchema,
  startSessionPayloadSchema,
} from "@top-seed/contracts";
import { db } from "../db/database.js";
import type { LocalCourt, LocalQueueLane, LocalSession } from "../db/types.js";
import { DEFAULT_ORG_ID } from "../lib/device.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export const createSessionInputSchema = z.object({
  id: z.string(),
  organizationId: z.string().default(DEFAULT_ORG_ID),
  name: z.string().min(1),
  venueName: z.string().min(1),
  startsAt: z.string().datetime(),
  feeAmount: z.number().int().nonnegative(),
  currency: z.string().default("PHP"),
  queueMode: z.enum(["suggested", "manual"]).default("suggested"),
  ratingMode: z.enum(["casual", "rated"]).default("casual"),
  courtCount: z.number().int().min(2).max(8).default(2),
  startImmediately: z.boolean().default(true),
});

export type CreateSessionInput = z.input<typeof createSessionInputSchema>;

export interface CreateSessionResult {
  session: LocalSession;
  lane: LocalQueueLane;
  courts: LocalCourt[];
}

export async function createSessionLocal(
  input: CreateSessionInput,
  options?: { createActionId?: string; startActionId?: string },
): Promise<CreateSessionResult> {
  const parsed = createSessionInputSchema.parse(input);
  const createdAt = parsed.startsAt;
  const createActionId = options?.createActionId ?? crypto.randomUUID();
  const startActionId = options?.startActionId ?? crypto.randomUUID();

  return applyMutation({
    run: async () => {
      return runInTransaction(async () => {
        const session: LocalSession = {
          id: parsed.id,
          organizationId: parsed.organizationId,
          name: parsed.name,
          venueName: parsed.venueName,
          startsAt: parsed.startsAt,
          status: parsed.startImmediately ? "active" : "draft",
          feeAmount: parsed.feeAmount,
          currency: parsed.currency,
          queueMode: parsed.queueMode,
          ratingMode: parsed.ratingMode,
        };

        const lane: LocalQueueLane = {
          id: `${parsed.id}-lane-1`,
          sessionId: parsed.id,
          name: "Next",
          sortOrder: 0,
          status: "open",
        };

        const courts: LocalCourt[] = Array.from({ length: parsed.courtCount }, (_, index) => ({
          id: `${parsed.id}-court-${index + 1}`,
          sessionId: parsed.id,
          name: `Court ${index + 1}`,
          status: "open",
          sortOrder: index,
        }));

        const createPayload = createSessionPayloadSchema.parse({
          name: parsed.name,
          venueName: parsed.venueName,
          startsAt: parsed.startsAt,
          endsAt: null,
          feeAmount: parsed.feeAmount,
          currency: parsed.currency,
          queueMode: parsed.queueMode,
          ratingMode: parsed.ratingMode,
          requirePaymentBeforePlay: false,
        });

        await db.sessions.put(session);
        await db.queueLanes.put(lane);
        await db.courts.bulkPut(courts);

        await enqueueSyncAction({
          id: createActionId,
          organizationId: parsed.organizationId,
          type: "CREATE_SESSION",
          entityType: "session",
          entityId: parsed.id,
          sessionId: parsed.id,
          payload: createPayload,
          createdAt,
        });

        if (parsed.startImmediately) {
          const startPayload = startSessionPayloadSchema.parse({
            startedAt: createdAt,
          });
          await enqueueSyncAction({
            id: startActionId,
            organizationId: parsed.organizationId,
            type: "START_SESSION",
            entityType: "session",
            entityId: parsed.id,
            sessionId: parsed.id,
            payload: startPayload,
            createdAt,
          });
        }

        return { session, lane, courts };
      });
    },
  });
}
