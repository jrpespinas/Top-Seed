import type { OutboxAction } from "../../db/types.js";

export type SyncReviewGroup = "failed" | "blocked" | "pending";

export interface GroupedSyncActions {
  failed: OutboxAction[];
  blocked: OutboxAction[];
  pending: OutboxAction[];
}

export function groupSyncActions(actions: OutboxAction[]): GroupedSyncActions {
  const failed: OutboxAction[] = [];
  const blocked: OutboxAction[] = [];
  const pending: OutboxAction[] = [];

  for (const action of actions) {
    if (action.status === "failed") {
      failed.push(action);
    } else if (action.status === "blocked") {
      blocked.push(action);
    } else if (action.status === "pending") {
      pending.push(action);
    }
  }

  failed.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  blocked.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return { failed, blocked, pending };
}

export function buildSyncReviewSummary(counts: {
  failed: number;
  blocked: number;
  pending: number;
}): string {
  const parts: string[] = [];
  if (counts.failed > 0) {
    parts.push(`${counts.failed} failed`);
  }
  if (counts.blocked > 0) {
    parts.push(`${counts.blocked} blocked`);
  }
  if (counts.pending > 0) {
    parts.push(`${counts.pending} waiting to sync`);
  }
  return parts.join(" · ") || "No sync issues";
}

export function hasSyncIssues(counts: { failed: number; blocked: number; pending: number }): boolean {
  return counts.failed > 0 || counts.blocked > 0 || counts.pending > 0;
}
