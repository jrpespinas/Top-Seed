export type SyncStatus = "local" | "pending" | "syncing" | "synced" | "failed";

export type OutboxActionStatus = "pending" | "syncing" | "applied" | "failed" | "blocked";

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
  phone?: string;
  gender?: string;
  notes?: string;
  syncStatus?: SyncStatus;
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
  matchesPlayedInSession?: number;
  lastMatchEndedAt?: string | null;
  suggestionExcluded?: boolean;
  suggestionExcludeNote?: string;
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
  currentMatchId?: string | null;
}

export interface LocalQueueLane {
  id: string;
  sessionId: string;
  name: string;
  sortOrder: number;
  status: string;
  syncStatus?: SyncStatus;
}

export interface LocalQueuedMatchParticipant {
  checkInId: string;
  playerProfileId: string;
  team: "team_one" | "team_two";
  slotOrder: 1 | 2;
}

export interface LocalQueuedMatch {
  id: string;
  sessionId: string;
  queueLaneId: string;
  status: string;
  sortOrder: number;
  createdFrom: "manual" | "suggestion";
  participants: LocalQueuedMatchParticipant[];
  syncStatus?: SyncStatus;
}

export interface LocalMatchParticipant {
  checkInId: string;
  playerProfileId: string;
  team: "team_one" | "team_two";
  ratingBefore?: number;
  ratingAfter?: number;
  ratingDelta?: number;
}

export interface LocalMatch {
  id: string;
  sessionId: string;
  courtId: string;
  queuedMatchId?: string | null;
  status: string;
  outcome?: string | null;
  winningTeam?: "team_one" | "team_two" | null;
  teamOneScore?: number | null;
  teamTwoScore?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  completedAt?: string | null;
  participants: LocalMatchParticipant[];
  syncStatus?: SyncStatus;
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
  blockedByActionId?: string;
  retryCount?: number;
}
