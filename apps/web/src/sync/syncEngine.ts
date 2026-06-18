import { db } from "../db/database.js";
import { normalizeSessionCourtsIfNeeded } from "../mutations/courts.js";
import type { LocalCheckIn, LocalCourt, OutboxAction } from "../db/types.js";
import {
  listBlockedOutboxActions,
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
import { ensureSessionOnServer } from "../lib/session-api.js";
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

async function restoreCourtAfterFailedDelete(action: OutboxAction): Promise<void> {
  if (action.type !== "DELETE_COURT" || !action.sessionId) {
    return;
  }

  const payload = action.payload as {
    name?: string;
    sortOrder?: number;
    status?: LocalCourt["status"];
  };
  if (!payload.name || payload.sortOrder === undefined) {
    return;
  }

  const existing = await db.courts.get(action.entityId);
  if (existing) {
    return;
  }

  await db.courts.put({
    id: action.entityId,
    sessionId: action.sessionId,
    name: payload.name,
    sortOrder: payload.sortOrder,
    status: payload.status ?? "open",
  });
  await normalizeSessionCourtsIfNeeded(action.sessionId);
}

function isBootstrapRecoverableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("session not found") ||
    lower.includes("court not found") ||
    lower.includes("queue lane not found") ||
    lower.includes("check-in not found") ||
    lower.includes("player not found")
  );
}

function isIdempotentCheckInError(message: string): boolean {
  return message.toLowerCase().includes("player is already checked in");
}

async function prepareActionForSync(action: OutboxAction): Promise<OutboxAction | "skip"> {
  if (!action.sessionId) {
    return action;
  }

  if (action.type === "UPDATE_COURT") {
    const court = await db.courts.get(action.entityId);
    if (!court || court.sessionId !== action.sessionId) {
      return "skip";
    }
    const payload = action.payload as {
      name?: string;
      sortOrder?: number;
      status?: LocalCourt["status"];
    };
    return {
      ...action,
      payload: {
        name: payload.name ?? court.name,
        sortOrder: payload.sortOrder ?? court.sortOrder,
        status: payload.status ?? court.status,
      },
    };
  }

  if (action.type === "UPDATE_QUEUE_LANE") {
    const lane = await db.queueLanes.get(action.entityId);
    if (!lane || lane.sessionId !== action.sessionId || lane.status === "deleted") {
      return "skip";
    }
    const payload = action.payload as {
      name?: string;
      sortOrder?: number;
      status?: string;
    };
    return {
      ...action,
      payload: {
        name: payload.name ?? lane.name,
        sortOrder: payload.sortOrder ?? lane.sortOrder,
        status: payload.status ?? lane.status,
      },
    };
  }

  if (action.type === "DELETE_COURT") {
    const court = await db.courts.get(action.entityId);
    if (!court) {
      return "skip";
    }
  }

  if (action.type === "DELETE_QUEUE_LANE") {
    const lane = await db.queueLanes.get(action.entityId);
    if (!lane || lane.status === "deleted") {
      return "skip";
    }
  }

  return action;
}

async function ensureSessionForAction(action: OutboxAction): Promise<void> {
  if (!action.sessionId || isSessionSyncAction(action.type)) {
    return;
  }
  try {
    await ensureSessionOnServer(action.sessionId);
  } catch {
    // Continue — payload repair and server upsert may still succeed.
  }
}

async function markActionFailed(action: OutboxAction, message: string): Promise<void> {
  if (action.type === "DELETE_COURT") {
    await restoreCourtAfterFailedDelete(action);
  }
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

  if (sessionId) {
    try {
      await ensureSessionOnServer(sessionId);
    } catch {
      // Flush may still succeed; individual actions retry bootstrap on session-not-found.
    }
  }

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
        await ensureSessionForAction(action);

        const prepared = await prepareActionForSync(action);
        if (prepared === "skip") {
          await markOutboxApplied(action.id);
          flushed += 1;
          pending = await listPendingOutboxActions(sessionId);
          continue;
        }

        const batch = [prepared];
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
          const message = result.message ?? result.errorCode ?? "Sync failed";
          if (action.type === "CHECK_IN_PLAYER" && isIdempotentCheckInError(message)) {
            await markOutboxApplied(action.id);
            await markEntitySynced(action);
            flushed += 1;
            pending = await listPendingOutboxActions(sessionId);
            continue;
          }
          if (action.sessionId && isBootstrapRecoverableError(message)) {
            await ensureSessionOnServer(action.sessionId);
            const retryResponse = await postSyncActions(
              outboxToSyncRequest(DEFAULT_ORG_ID, getDeviceId(), batch),
            );
            const retryResult = retryResponse.results[0];
            if (
              retryResult &&
              (retryResult.status === "applied" || retryResult.status === "already_applied")
            ) {
              await markOutboxApplied(action.id);
              await markEntitySynced(action, retryResult.serverUpdatedAt);
              flushed += 1;
              pending = await listPendingOutboxActions(sessionId);
              continue;
            }
          }
          await markActionFailed(action, message);
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
  if (action.sessionId) {
    await ensureSessionOnServer(action.sessionId);
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
  if (sessionId) {
    await ensureSessionOnServer(sessionId);
  }

  const failed = await listFailedOutboxActions(sessionId);
  const blocked = await listBlockedOutboxActions(sessionId);
  for (const action of [...failed, ...blocked]) {
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
