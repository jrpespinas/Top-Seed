import { describe, expect, it } from "vitest";
import {
  getSessionMode,
  isEndedSession,
  isLiveSession,
  formatSessionStatus,
} from "./session-mode.js";

describe("session-mode", () => {
  it("treats active statuses as live", () => {
    expect(getSessionMode("draft")).toBe("live");
    expect(getSessionMode("open")).toBe("live");
    expect(getSessionMode("active")).toBe("live");
    expect(isLiveSession("active")).toBe(true);
  });

  it("treats completed and cancelled as ended", () => {
    expect(getSessionMode("completed")).toBe("ended");
    expect(getSessionMode("cancelled")).toBe("ended");
    expect(isEndedSession("completed")).toBe(true);
  });

  it("formats session status labels", () => {
    expect(formatSessionStatus("active")).toBe("Active");
    expect(formatSessionStatus("completed")).toBe("Completed");
  });
});
