import type { SessionMode } from "../components/domain/types.js";

const LIVE_STATUSES = new Set(["draft", "open", "active"]);
const ENDED_STATUSES = new Set(["completed", "cancelled"]);

export function getSessionMode(status: string): SessionMode {
  if (ENDED_STATUSES.has(status)) {
    return "ended";
  }
  return "live";
}

export function isLiveSession(status: string): boolean {
  return LIVE_STATUSES.has(status);
}

export function isEndedSession(status: string): boolean {
  return ENDED_STATUSES.has(status);
}

export function formatSessionStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    open: "Open",
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}
