import { db } from "../db/database.js";
import type { LocalCheckIn, OutboxAction } from "../db/types.js";
import {
  listFailedOutboxActions,
  listPendingOutboxActions,
  markOutboxApplied,
  markOutboxBlocked,
  markOutboxFailed,
  markOutboxSyncing,
  resetFailedToPending,
  unblockDependentsOf,
} from "./outbox.js";
import { outboxToSyncRequest, postSyncActions } from "./syncClient.js";
import { getConnectionStatus } from "./connection.js";
import { isSessionSyncAction, syncSessionActionViaRest } from "./sessionActionSync.js";
import { DEFAULT_ORG_ID, getDeviceId } from "../lib/device.js";

async function markEntitySyncFailed(action: OutboxAction, message: string): Promise<void> {
  if (action.entityType === "checkIn") {
    await db.checkIns.update(action.entityId, {
      syncStatus: "failed",
      lastSyncError: message,
    });
  } else if (action.entityType === "match") {
    await db.matches.update(action.entityId, {
      syncStatus: "failed",
    });
  } else if (action.entityType === "playerProfile") {
    await db.playerProfiles.update(action.entityId, {
      syncStatus: "failed",
    });
  }
}

async function markEntitySynced(action: OutboxAction, serverUpdatedAt?: string): Promise<void> {
  if (action.entityType === "checkIn") {
    await db.checkIns.update(action.entityId, {
      syncStatus: "synced",
      lastSyncedAt: serverUpdatedAt ?? new Date().toISOString(),
      lastSyncError: undefined,
    });
  } else if (action.entityType === "match") {
    await db.matches.update(action.entityId, { syncStatus: "synced" });
  } else if (action.entityType === "playerProfile") {
    await db.playerProfiles.update(action.entityId, { syncStatus: "synced" });
  }
}

/**
 * Conservative MVP: later actions in the same session (by createdAt) are blocked
 * when an earlier action fails.
 */
export async function markDependentsBlocked(failedAction: OutboxAction): Promise<void> {
  const candidates = await db.syncOutbox
    .where("sessionId")
    .equals(failedAction.sessionId)
    .toArray();

  for (const candidate of candidates) {
    if (
      candidate.id !== failedAction.id &&
      (candidate.status === "pending" || candidate.status === "blocked") &&
      candidate.createdAt > failedAction.createdAt
    ) {
      await markOutboxBlocked(candidate.id, failedAction.id);
    }
  }
}

async function markActionFailed(action: OutboxAction, message: string): Promise<void> {
  await markOutboxFailed(action.id, message);
  await markEntitySyncFailed(action, message);
  await markDependentsBlocked(action);
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
        await markEntitySynced(action);
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
          await markEntitySynced(action, result.serverUpdatedAt);
          flushed += 1;
        } else if (result.status === "failed") {
          await markActionFailed(action, result.message ?? result.errorCode ?? "Sync failed");
          failed += 1;
          break;
        } else if (result.status === "blocked") {
          await markOutboxBlocked(action.id, action.id);
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

export async function retryOutboxAction(actionId: string): Promise<void> {
  const action = await db.syncOutbox.get(actionId);
  if (!action || action.status !== "failed") {
    return;
  }
  await resetFailedToPending(actionId);
  await unblockDependentsOf(actionId);
  if (action.entityType === "checkIn") {
    await db.checkIns.update(action.entityId, {
      syncStatus: "pending",
      lastSyncError: undefined,
    });
  }
  await flushOutbox(action.sessionId || undefined);
}

export async function retryFailedOutbox(sessionId?: string): Promise<void> {
  const failed = await listFailedOutboxActions(sessionId);
  for (const action of failed) {
    await resetFailedToPending(action.id);
    await unblockDependentsOf(action.id);
    if (action.entityType === "checkIn") {
      await db.checkIns.update(action.entityId, {
        syncStatus: "pending",
        lastSyncError: undefined,
      });
    } else if (action.entityType === "match") {
      await db.matches.update(action.entityId, { syncStatus: "pending" });
    } else if (action.entityType === "playerProfile") {
      await db.playerProfiles.update(action.entityId, { syncStatus: "pending" });
    }
  }
  await flushOutbox(sessionId);
}

export async function getSessionCheckIns(sessionId: string): Promise<LocalCheckIn[]> {
  return db.checkIns.where("sessionId").equals(sessionId).sortBy("arrivalOrder");
}
