import { db } from "../db/database.js";
import type { LocalCheckIn, OutboxAction } from "../db/types.js";
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
import { isSessionSyncAction, syncSessionActionViaRest } from "./sessionActionSync.js";
import { DEFAULT_ORG_ID, getDeviceId } from "../lib/device.js";

async function markActionFailed(action: OutboxAction, message: string): Promise<void> {
  await markOutboxFailed(action.id, message);
  if (action.entityType === "checkIn") {
    await db.checkIns.update(action.entityId, {
      syncStatus: "failed",
      lastSyncError: message,
    });
  }
}

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
    const action = pending[0];
    if (!action) {
      break;
    }

    await markOutboxSyncing(action.id);

    try {
      if (isSessionSyncAction(action.type)) {
        await syncSessionActionViaRest(action);
        await markOutboxApplied(action.id);
        flushed += 1;
      } else {
        const batch = [action];
        const response = await postSyncActions(
          outboxToSyncRequest(DEFAULT_ORG_ID, getDeviceId(), batch),
        );
        const result = response.results[0];
        if (!result) {
          throw new Error("Sync returned no result.");
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
        } else if (result.status === "failed" || result.status === "blocked") {
          await markActionFailed(action, result.message ?? result.errorCode ?? "Sync failed");
          failed += 1;
          break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      await markActionFailed(action, message);
      failed += 1;
      break;
    }

    pending = await listPendingOutboxActions(sessionId);
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
