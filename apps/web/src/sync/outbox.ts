import { db } from "../db/database.js";
import type { OutboxAction, OutboxActionStatus } from "../db/types.js";

export async function enqueueSyncAction(
  action: Omit<OutboxAction, "status"> & { status?: OutboxActionStatus },
): Promise<OutboxAction> {
  const record: OutboxAction = {
    ...action,
    status: action.status ?? "pending",
  };
  await db.syncOutbox.put(record);
  return record;
}

export async function listPendingOutboxActions(sessionId?: string): Promise<OutboxAction[]> {
  if (sessionId) {
    return db.syncOutbox
      .where({ sessionId, status: "pending" })
      .sortBy("createdAt");
  }
  return db.syncOutbox.where("status").equals("pending").sortBy("createdAt");
}

export async function listFailedOutboxActions(sessionId?: string): Promise<OutboxAction[]> {
  if (sessionId) {
    return db.syncOutbox.where({ sessionId, status: "failed" }).toArray();
  }
  return db.syncOutbox.where("status").equals("failed").toArray();
}

export async function countOutboxByStatus(sessionId?: string): Promise<{
  pending: number;
  failed: number;
}> {
  const pending = sessionId
    ? await db.syncOutbox.where({ sessionId, status: "pending" }).count()
    : await db.syncOutbox.where("status").equals("pending").count();
  const failed = sessionId
    ? await db.syncOutbox.where({ sessionId, status: "failed" }).count()
    : await db.syncOutbox.where("status").equals("failed").count();
  return { pending, failed };
}

export async function markOutboxSyncing(actionId: string): Promise<void> {
  await db.syncOutbox.update(actionId, { status: "syncing" });
}

export async function markOutboxApplied(actionId: string): Promise<void> {
  await db.syncOutbox.update(actionId, { status: "applied", errorMessage: undefined });
}

export async function markOutboxFailed(actionId: string, errorMessage: string): Promise<void> {
  await db.syncOutbox.update(actionId, { status: "failed", errorMessage });
}

export async function resetFailedToPending(actionId: string): Promise<void> {
  await db.syncOutbox.update(actionId, { status: "pending", errorMessage: undefined });
}
