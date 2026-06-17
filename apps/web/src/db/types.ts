export type SyncStatus = "local" | "pending" | "syncing" | "synced" | "failed";

export type OutboxActionStatus = "pending" | "syncing" | "applied" | "failed";

export interface LocalSession {
  id: string;
  organizationId: string;
  name: string;
  venueName: string;
  startsAt: string;
  status: string;
  feeAmount: number;
  currency: string;
  queueMode: "suggested" | "manual";
  ratingMode: "casual" | "rated";
  serverVersion?: number;
}

export interface LocalPlayerProfile {
  id: string;
  organizationId: string;
  displayName: string;
  defaultSkillRating: number;
}

export interface LocalCheckIn {
  id: string;
  sessionId: string;
  playerProfileId: string;
  playerDisplayName: string;
  arrivalOrder: number;
  checkedInAt: string;
  queueStatus: string;
  sessionSkillRating: number;
  paymentStatus: string;
  paymentAmountDue: number;
  paymentAmountPaid: number;
  paymentMethod: string;
  paymentNotes: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  lastSyncError?: string;
}

export interface LocalCourt {
  id: string;
  sessionId: string;
  name: string;
  status: string;
  sortOrder: number;
}

export interface LocalQueueLane {
  id: string;
  sessionId: string;
  name: string;
  sortOrder: number;
  status: string;
}

export interface LocalQueuedMatch {
  id: string;
  sessionId: string;
  queueLaneId: string;
  status: string;
  sortOrder: number;
}

export interface LocalMatch {
  id: string;
  sessionId: string;
  courtId: string;
  status: string;
}

export interface OutboxAction {
  id: string;
  organizationId: string;
  type: string;
  entityType: string;
  entityId: string;
  sessionId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: OutboxActionStatus;
  errorMessage?: string;
}
