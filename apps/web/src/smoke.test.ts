import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@top-seed/contracts";

describe("healthResponseSchema", () => {
  it("parses a valid health payload", () => {
    const parsed = healthResponseSchema.parse({
      data: { status: "ok" },
      meta: { serverTime: "2026-06-09T00:00:00.000Z" },
    });
    expect(parsed.data.status).toBe("ok");
  });
});
