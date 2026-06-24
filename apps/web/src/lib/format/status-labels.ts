export type QueueStatus =
  | "waiting"
  | "assigned"
  | "playing"
  | "resting"
  | "done"
  | "removed";

export type CourtBackendStatus = "open" | "occupied" | "paused" | "unavailable";
export type MatchStatus = "assigned" | "in_progress" | "completed" | "cancelled";

export type CourtUiStatus =
  | "open"
  | "partiallyFilled"
  | "occupied"
  | "inProgress"
  | "paused"
  | "unavailable";

const QUEUE_LABELS: Record<QueueStatus, string> = {
  waiting: "Waiting",
  assigned: "Assigned",
  playing: "Playing",
  resting: "Resting",
  done: "Done",
  removed: "Removed",
};

const COURT_LABELS: Record<CourtUiStatus, string> = {
  open: "Open",
  partiallyFilled: "Partially filled",
  occupied: "Occupied",
  inProgress: "In progress",
  paused: "Paused",
  unavailable: "Unavailable",
};

const MATCH_LABELS: Record<MatchStatus | "queued" | "queuedIncomplete" | "ready" | "draft", string> = {
  queued: "Queued",
  queuedIncomplete: "Draft",
  draft: "Draft",
  ready: "Ready",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  waived: "Waived",
  refunded: "Refunded",
};

export function formatQueueStatus(status: string): string {
  return QUEUE_LABELS[status as QueueStatus] ?? status;
}

export function formatCourtUiStatus(status: CourtUiStatus): string {
  return COURT_LABELS[status];
}

export function formatMatchStatus(status: string): string {
  return MATCH_LABELS[status as keyof typeof MATCH_LABELS] ?? status;
}

export function formatPaymentStatus(status: string): string {
  return PAYMENT_LABELS[status] ?? status;
}

export function formatCourtStatus(
  courtStatus: CourtBackendStatus,
  matchStatus?: MatchStatus,
  rosterFull = false,
): CourtUiStatus {
  if (courtStatus === "paused") {
    return "paused";
  }
  if (courtStatus === "unavailable") {
    return "unavailable";
  }
  if (courtStatus === "open" && !matchStatus) {
    return "open";
  }
  if (matchStatus === "in_progress") {
    return "inProgress";
  }
  if (matchStatus === "assigned" && !rosterFull) {
    return "partiallyFilled";
  }
  if (courtStatus === "occupied" || matchStatus === "assigned") {
    return rosterFull ? "occupied" : "partiallyFilled";
  }
  return "open";
}
