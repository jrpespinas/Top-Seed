import { describe, expect, it } from "vitest";
import type { CheckInDto } from "@top-seed/contracts";
import type { LocalCheckIn } from "../db/types.js";
import { mergeCheckIns, mergeSnapshot } from "../sync/mergeSnapshot.js";

function localCheckIn(overrides: Partial<LocalCheckIn> = {}): LocalCheckIn {
  return {
    id: "check-in-1",
    sessionId: "session-1",
    playerProfileId: "player-1",
    playerDisplayName: "Alex",
    arrivalOrder: 0,
    checkedInAt: "2026-06-09T10:00:00.000Z",
    queueStatus: "waiting",
    sessionSkillRating: 1200,
    paymentStatus: "unpaid",
    paymentAmountDue: 150,
    paymentAmountPaid: 0,
    paymentMethod: "none",
    paymentNotes: "",
    syncStatus: "pending",
    ...overrides,
  };
}

function serverCheckIn(overrides: Partial<CheckInDto> = {}): CheckInDto {
  return {
    id: "check-in-1",
    sessionId: "session-1",
    playerProfileId: "player-1",
    playerDisplayName: "Alex (server)",
    arrivalOrder: 0,
    checkedInAt: "2026-06-09T10:00:00.000Z",
    queueStatus: "waiting",
    sessionSkillRating: 1200,
    paymentStatus: "paid",
    paymentAmountDue: 150,
    paymentAmountPaid: 150,
    paymentMethod: "cash",
    paymentNotes: "",
    createdAt: "2026-06-09T10:00:00.000Z",
    updatedAt: "2026-06-09T10:00:00.000Z",
    ...overrides,
  };
}

describe("mergeSnapshot", () => {
  it("keeps pending local check-in when server snapshot differs", () => {
    const local = localCheckIn({ syncStatus: "pending", playerDisplayName: "Local Alex" });
    const merged = mergeCheckIns([local], [serverCheckIn()]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.playerDisplayName).toBe("Local Alex");
    expect(merged[0]?.syncStatus).toBe("pending");
  });

  it("keeps failed local check-in over server data", () => {
    const local = localCheckIn({ syncStatus: "failed", lastSyncError: "timeout" });
    const merged = mergeCheckIns([local], [serverCheckIn({ paymentStatus: "paid" })]);

    expect(merged[0]?.syncStatus).toBe("failed");
    expect(merged[0]?.paymentStatus).toBe("unpaid");
  });

  it("accepts synced server rows when no protected local row exists", () => {
    const merged = mergeCheckIns([], [serverCheckIn({ id: "server-only" })]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("server-only");
    expect(merged[0]?.syncStatus).toBe("synced");
    expect(merged[0]?.paymentStatus).toBe("paid");
  });

  it("retains local-only check-ins not present on server", () => {
    const localOnly = localCheckIn({ id: "local-only", syncStatus: "pending" });
    const merged = mergeCheckIns([localOnly], []);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("local-only");
  });

  it("sorts merged check-ins by arrival order", () => {
    const merged = mergeCheckIns(
      [localCheckIn({ id: "b", arrivalOrder: 1 })],
      [serverCheckIn({ id: "a", arrivalOrder: 0 })],
    );
    expect(merged.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("returns server version from snapshot wrapper", () => {
    const result = mergeSnapshot([localCheckIn()], {
      checkIns: [],
      sync: { serverVersion: 42 },
    });
    expect(result.serverVersion).toBe(42);
    expect(result.checkIns).toHaveLength(1);
  });
});
