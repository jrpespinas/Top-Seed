import { db } from "../db/database.js";
import type { LocalCheckIn } from "../db/types.js";
import {
  listFailedOutboxActions,
  listPendingOutboxActions,
  markOutboxApplied,
  markOutboxFailed,
  markOutboxSyncing,
  resetFailedToPending,
} from "./outbox.js";
import { outboxToSyncRequest, postSyncActions } from "./syncClient.js";
import { getConnectionStatus } from "./connection.js";
import { DEFAULT_ORG_ID, getDeviceId } from "../lib/device.js";

export async function flushOutbox(sessionId?: string): Promise<{
  flushed: number;
  failed: number;
}> {
  if (!getConnectionStatus()) {
    return { flushed: 0, failed: 0 };
  }

  let flushed = 0;
  let failed = 0;
  let pending = await listPendingOutboxActions(sessionId);

  while (pending.length > 0) {
    const batch = pending.slice(0, 10);
    for (const action of batch) {
      await markOutboxSyncing(action.id);
    }

    try {
      const response = await postSyncActions(
        outboxToSyncRequest(DEFAULT_ORG_ID, getDeviceId(), batch),
      );

      for (const result of response.results) {
        const action = batch.find((item) => item.id === result.actionId);
        if (!action) {
          continue;
        }

        if (result.status === "applied" || result.status === "already_applied") {
          await markOutboxApplied(action.id);
          if (action.entityType === "checkIn") {
            await db.checkIns.update(action.entityId, {
              syncStatus: "synced",
              lastSyncedAt: result.serverUpdatedAt ?? new Date().toISOString(),
              lastSyncError: undefined,
            });
          }
          flushed += 1;
        } else if (result.status === "failed") {
          await markOutboxFailed(action.id, result.message ?? result.errorCode ?? "Sync failed");
          if (action.entityType === "checkIn") {
            await db.checkIns.update(action.entityId, {
              syncStatus: "failed",
              lastSyncError: result.message ?? result.errorCode,
            });
          }
          failed += 1;
          pending = [];
          break;
        } else if (result.status === "blocked") {
          await markOutboxFailed(action.id, result.message ?? "Blocked by earlier failure.");
          failed += 1;
          pending = [];
          break;
        }
      }

      if (pending.length > 0) {
        pending = await listPendingOutboxActions(sessionId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      for (const action of batch) {
        await markOutboxFailed(action.id, message);
        if (action.entityType === "checkIn") {
          await db.checkIns.update(action.entityId, {
            syncStatus: "failed",
            lastSyncError: message,
          });
        }
        failed += 1;
      }
      break;
    }
  }

  return { flushed, failed };
}

export async function retryFailedOutbox(sessionId?: string): Promise<void> {
  const failed = await listFailedOutboxActions(sessionId);
  for (const action of failed) {
    await resetFailedToPending(action.id);
    if (action.entityType === "checkIn") {
      await db.checkIns.update(action.entityId, {
        syncStatus: "pending",
        lastSyncError: undefined,
      });
    }
  }
  await flushOutbox(sessionId);
}

export async function getSessionCheckIns(sessionId: string): Promise<LocalCheckIn[]> {
  return db.checkIns.where("sessionId").equals(sessionId).sortBy("arrivalOrder");
}
