import { describe, expect, it } from "vitest";
import {
  defaultSessionFormValues,
  sessionFormSchema,
  toIsoDateTime,
} from "./session-form.js";

describe("sessionFormSchema", () => {
  it("rejects missing required fields", () => {
    const result = sessionFormSchema.safeParse({
      ...defaultSessionFormValues,
      name: "",
      venueName: "",
      startsAtLocal: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid defaults shape", () => {
    const result = sessionFormSchema.safeParse({
      ...defaultSessionFormValues,
      name: "Tuesday Open Play",
      venueName: "Courts 1-4",
      startsAtLocal: "2026-06-09T18:00",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.queueMode).toBe("suggested");
      expect(result.data.ratingMode).toBe("casual");
    }
  });

  it("converts local datetime to ISO", () => {
    const iso = toIsoDateTime("2026-06-09T18:00");
    expect(iso).toContain("2026-06-09");
  });
});
