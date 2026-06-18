import { db } from "../db/database.js";
import type { OutboxAction, OutboxActionStatus } from "../db/types.js";

export async function enqueueSyncAction(
  action: Omit<OutboxAction, "status"> & { status?: OutboxActionStatus },
): Promise<OutboxAction> {
  const record: OutboxAction = {
    ...action,
    status: action.status ?? "pending",
    retryCount: action.retryCount ?? 0,
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

export async function listBlockedOutboxActions(sessionId?: string): Promise<OutboxAction[]> {
  if (sessionId) {
    return db.syncOutbox.where({ sessionId, status: "blocked" }).toArray();
  }
  return db.syncOutbox.where("status").equals("blocked").toArray();
}

export async function listReviewableOutboxActions(sessionId?: string): Promise<OutboxAction[]> {
  const statuses: OutboxActionStatus[] = ["pending", "failed", "blocked"];
  if (sessionId) {
    const rows = await db.syncOutbox.where("sessionId").equals(sessionId).toArray();
    return rows
      .filter((row) => statuses.includes(row.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const rows = await db.syncOutbox.toArray();
  return rows
    .filter((row) => statuses.includes(row.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countOutboxByStatus(sessionId?: string): Promise<{
  pending: number;
  failed: number;
  blocked: number;
}> {
  const pending = sessionId
    ? await db.syncOutbox.where({ sessionId, status: "pending" }).count()
    : await db.syncOutbox.where("status").equals("pending").count();
  const failed = sessionId
    ? await db.syncOutbox.where({ sessionId, status: "failed" }).count()
    : await db.syncOutbox.where("status").equals("failed").count();
  const blocked = sessionId
    ? await db.syncOutbox.where({ sessionId, status: "blocked" }).count()
    : await db.syncOutbox.where("status").equals("blocked").count();
  return { pending, failed, blocked };
}

export async function markOutboxSyncing(actionId: string): Promise<void> {
  await db.syncOutbox.update(actionId, { status: "syncing" });
}

export async function markOutboxApplied(actionId: string): Promise<void> {
  await db.syncOutbox.update(actionId, {
    status: "applied",
    errorMessage: undefined,
    blockedByActionId: undefined,
  });
}

export async function markOutboxFailed(actionId: string, errorMessage: string): Promise<void> {
  await db.syncOutbox.update(actionId, { status: "failed", errorMessage });
}

export async function markOutboxBlocked(actionId: string, blockedByActionId: string): Promise<void> {
  await db.syncOutbox.update(actionId, {
    status: "blocked",
    blockedByActionId,
    errorMessage: "Waiting on an earlier change before this can sync.",
  });
}

export async function resetFailedToPending(actionId: string): Promise<void> {
  const existing = await db.syncOutbox.get(actionId);
  await db.syncOutbox.update(actionId, {
    status: "pending",
    errorMessage: undefined,
    blockedByActionId: undefined,
    retryCount: (existing?.retryCount ?? 0) + 1,
  });
}

export async function unblockDependentsOf(actionId: string): Promise<void> {
  const dependents = await db.syncOutbox.where("blockedByActionId").equals(actionId).toArray();
  for (const dependent of dependents) {
    await db.syncOutbox.update(dependent.id, {
      status: "pending",
      blockedByActionId: undefined,
      errorMessage: undefined,
    });
  }
}
