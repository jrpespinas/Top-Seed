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

function isCreatePlayerProfileAction(type: string): boolean {
  return type === "CREATE_PLAYER_PROFILE" || type === "CREATE_PLAYER";
}

function isOrgScopedOutboxAction(action: OutboxAction): boolean {
  return (
    !action.sessionId ||
    action.sessionId === "" ||
    isCreatePlayerProfileAction(action.type) ||
    action.type === "UPDATE_PLAYER_PROFILE"
  );
}

function isSessionLifecycleAction(type: string): boolean {
  return type === "CREATE_SESSION" || type === "START_SESSION";
}

/** Lower runs first during flush. Session must exist on server before check-ins. */
function actionFlushPriority(action: OutboxAction): number {
  switch (action.type) {
    case "CREATE_SESSION":
      return 0;
    case "START_SESSION":
      return 1;
    case "CREATE_PLAYER_PROFILE":
    case "CREATE_PLAYER":
    case "UPDATE_PLAYER_PROFILE":
      return 2;
    case "CHECK_IN_PLAYER":
      return 3;
    case "UPDATE_CHECK_IN":
    case "UPDATE_PAYMENT":
      return 4;
    case "CREATE_COURT":
    case "CREATE_QUEUE_LANE":
      return 5;
    case "UPDATE_COURT":
    case "UPDATE_QUEUE_LANE":
    case "REORDER_QUEUE_LANES":
      return 6;
    case "DELETE_COURT":
    case "DELETE_QUEUE_LANE":
      return 7;
    default:
      return 8;
  }
}

function compareOutboxActions(a: OutboxAction, b: OutboxAction): number {
  const priorityDiff = actionFlushPriority(a) - actionFlushPriority(b);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const aCreatesProfile = isCreatePlayerProfileAction(a.type);
  const bCreatesProfile = isCreatePlayerProfileAction(b.type);
  const aCheckIn = a.type === "CHECK_IN_PLAYER";
  const bCheckIn = b.type === "CHECK_IN_PLAYER";

  if (aCreatesProfile && bCheckIn && b.payload.playerProfileId === a.entityId) {
    return -1;
  }
  if (bCreatesProfile && aCheckIn && a.payload.playerProfileId === b.entityId) {
    return 1;
  }

  if (isSessionLifecycleAction(a.type) && isSessionLifecycleAction(b.type)) {
    if (a.type === "CREATE_SESSION" && b.type === "START_SESSION") {
      return -1;
    }
    if (a.type === "START_SESSION" && b.type === "CREATE_SESSION") {
      return 1;
    }
  }

  return a.createdAt.localeCompare(b.createdAt);
}

export async function listPendingForFlush(sessionId?: string): Promise<OutboxAction[]> {
  const pending = await db.syncOutbox.where("status").equals("pending").toArray();

  const filtered = sessionId
    ? pending.filter((action) => action.sessionId === sessionId || isOrgScopedOutboxAction(action))
    : pending;

  return filtered.sort(compareOutboxActions);
}

export async function listPendingOutboxActions(sessionId?: string): Promise<OutboxAction[]> {
  return listPendingForFlush(sessionId);
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
