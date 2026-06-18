/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { shouldShowAttentionRail } from "./attention-rail-helpers.js";

describe("shouldShowAttentionRail", () => {
  const healthy = {
    unpaidCount: 0,
    connectionStatus: "online" as const,
    syncStatus: "synced" as const,
    pendingCount: 0,
    failedCount: 0,
    blockedCount: 0,
  };

  it("is hidden when synced, online, and no unpaid players", () => {
    expect(shouldShowAttentionRail(healthy)).toBe(false);
  });

  it("shows when unpaid players exist", () => {
    expect(shouldShowAttentionRail({ ...healthy, unpaidCount: 2 })).toBe(true);
  });

  it("shows when sync failed", () => {
    expect(shouldShowAttentionRail({ ...healthy, failedCount: 1, syncStatus: "failed" })).toBe(
      true,
    );
  });

  it("shows when offline", () => {
    expect(shouldShowAttentionRail({ ...healthy, connectionStatus: "offline" })).toBe(true);
  });
});
