import { describe, expect, it } from "vitest";
import { formatWaitDuration } from "./duration.js";
import { formatMoney } from "./money.js";
import {
  formatCourtStatus,
  formatCourtUiStatus,
  formatMatchStatus,
  formatPaymentStatus,
  formatQueueStatus,
} from "./status-labels.js";

describe("formatMoney", () => {
  it("formats currency amounts", () => {
    expect(formatMoney(150, "PHP")).toContain("150");
  });
});

describe("formatWaitDuration", () => {
  it("formats minutes waited", () => {
    const now = new Date("2026-06-09T10:12:00.000Z");
    const checkedInAt = "2026-06-09T10:00:00.000Z";
    expect(formatWaitDuration(checkedInAt, now)).toBe("12 min");
  });

  it("returns sub-minute label for recent check-ins", () => {
    const now = new Date("2026-06-09T10:00:30.000Z");
    expect(formatWaitDuration("2026-06-09T10:00:00.000Z", now)).toBe("< 1 min");
  });
});

describe("status labels", () => {
  it("maps queue statuses to canonical labels", () => {
    expect(formatQueueStatus("waiting")).toBe("Waiting");
    expect(formatQueueStatus("resting")).toBe("Resting");
  });

  it("maps payment statuses", () => {
    expect(formatPaymentStatus("unpaid")).toBe("Unpaid");
    expect(formatPaymentStatus("waived")).toBe("Waived");
  });

  it("maps match statuses", () => {
    expect(formatMatchStatus("in_progress")).toBe("In progress");
    expect(formatMatchStatus("queuedIncomplete")).toBe("Draft");
  });

  it("maps court UI statuses", () => {
    expect(formatCourtUiStatus("inProgress")).toBe("In progress");
  });

  it("derives court UI state from backend status", () => {
    expect(formatCourtStatus("open")).toBe("open");
    expect(formatCourtStatus("occupied", "in_progress")).toBe("inProgress");
    expect(formatCourtStatus("occupied", "assigned", false)).toBe("partiallyFilled");
    expect(formatCourtStatus("occupied", "assigned", true)).toBe("occupied");
  });
});
