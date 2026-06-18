import { z } from "zod";
import { validateDeleteQueueLane } from "@top-seed/domain";
import { db } from "../db/database.js";
import type { LocalQueueLane } from "../db/types.js";
import { requireSession } from "../lib/mutation-utils.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export async function createQueueLaneLocal(input: {
  id: string;
  sessionId: string;
  name: string;
  sortOrder: number;
}): Promise<LocalQueueLane> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const lane: LocalQueueLane = {
          id: input.id,
          sessionId: input.sessionId,
          name: input.name,
          sortOrder: input.sortOrder,
          status: "open",
          syncStatus: "pending",
        };
        await db.queueLanes.put(lane);
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "CREATE_QUEUE_LANE",
          entityType: "queueLane",
          entityId: input.id,
          sessionId: input.sessionId,
          payload: {
            sessionId: input.sessionId,
            name: input.name,
            sortOrder: input.sortOrder,
          },
          createdAt: new Date().toISOString(),
        });
        return lane;
      }),
  });
}

export async function renameQueueLaneLocal(input: {
  sessionId: string;
  laneId: string;
  name: string;
}): Promise<LocalQueueLane> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const lane = await db.queueLanes.get(input.laneId);
        if (!lane || lane.sessionId !== input.sessionId) {
          throw new Error("Queue lane not found.");
        }
        const updated = { ...lane, name: input.name, syncStatus: "pending" as const };
        await db.queueLanes.put(updated);
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "UPDATE_QUEUE_LANE",
          entityType: "queueLane",
          entityId: input.laneId,
          sessionId: input.sessionId,
          payload: { name: input.name, sortOrder: lane.sortOrder, status: lane.status },
          createdAt: new Date().toISOString(),
        });
        return updated;
      }),
  });
}

export async function deleteQueueLaneLocal(input: {
  sessionId: string;
  laneId: string;
}): Promise<void> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const lanes = await db.queueLanes.where("sessionId").equals(input.sessionId).toArray();
        const validation = validateDeleteQueueLane(
          lanes
            .filter((lane) => lane.status !== "deleted")
            .map((lane) => ({ id: lane.id, isActive: true })),
          input.laneId,
        );
        if (!validation.ok) {
          throw new Error(validation.message);
        }

        const queuedMatches = await db.queuedMatches
          .where({ sessionId: input.sessionId, queueLaneId: input.laneId })
          .toArray();

        for (const queuedMatch of queuedMatches) {
          if (queuedMatch.status === "draft" || queuedMatch.status === "ready") {
            for (const participant of queuedMatch.participants) {
              const checkIn = await db.checkIns.get(participant.checkInId);
              if (checkIn && checkIn.queueStatus === "assigned") {
                const stillStaged = await db.queuedMatches
                  .where("sessionId")
                  .equals(input.sessionId)
                  .filter(
                    (qm) =>
                      qm.id !== queuedMatch.id &&
                      (qm.status === "draft" || qm.status === "ready") &&
                      qm.participants.some((p) => p.checkInId === participant.checkInId),
                  )
                  .count();
                if (stillStaged === 0) {
                  await db.checkIns.update(participant.checkInId, { queueStatus: "waiting" });
                }
              }
            }
            await db.queuedMatches.update(queuedMatch.id, {
              status: "removed",
              participants: [],
            });
          }
        }

        await db.queueLanes.update(input.laneId, { status: "deleted", syncStatus: "pending" });
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "DELETE_QUEUE_LANE",
          entityType: "queueLane",
          entityId: input.laneId,
          sessionId: input.sessionId,
          payload: { deleteQueuedMatches: true },
          createdAt: new Date().toISOString(),
        });
      }),
  });
}

export const reorderQueueLanesInputSchema = z.object({
  sessionId: z.string(),
  orderedLaneIds: z.array(z.string()).min(1),
});

export async function reorderQueueLanesLocal(input: z.infer<typeof reorderQueueLanesInputSchema>) {
  const parsed = reorderQueueLanesInputSchema.parse(input);
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(parsed.sessionId);
        for (const [index, laneId] of parsed.orderedLaneIds.entries()) {
          await db.queueLanes.update(laneId, { sortOrder: index });
        }
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "REORDER_QUEUE_LANES",
          entityType: "queueLane",
          entityId: parsed.orderedLaneIds[0]!,
          sessionId: parsed.sessionId,
          payload: { orderedLaneIds: parsed.orderedLaneIds },
          createdAt: new Date().toISOString(),
        });
      }),
  });
}
