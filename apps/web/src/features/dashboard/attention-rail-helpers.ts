export interface AttentionRailVisibilityInput {
  unpaidCount: number;
  connectionStatus: "online" | "offline";
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  pendingCount: number;
  failedCount: number;
  blockedCount: number;
}

export function shouldShowAttentionRail(input: AttentionRailVisibilityInput): boolean {
  if (input.unpaidCount > 0) {
    return true;
  }
  if (input.failedCount > 0 || input.blockedCount > 0) {
    return true;
  }
  if (input.connectionStatus === "offline") {
    return true;
  }
  if (input.syncStatus === "failed") {
    return true;
  }
  if (input.pendingCount > 0 || input.syncStatus === "pending" || input.syncStatus === "syncing") {
    return true;
  }
  return false;
}
