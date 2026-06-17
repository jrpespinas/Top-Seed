import { describe, expect, it } from "vitest";
import { DOMAIN_PLACEHOLDER } from "./index.js";

describe("domain package", () => {
  it("is wired for Phase 1", () => {
    expect(DOMAIN_PLACEHOLDER).toBe(true);
  });
});
