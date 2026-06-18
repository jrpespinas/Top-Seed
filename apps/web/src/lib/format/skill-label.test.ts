import { describe, expect, it } from "vitest";
import { formatSkillLabel } from "./skill-label.js";

describe("formatSkillLabel", () => {
  it("maps ratings to labels", () => {
    expect(formatSkillLabel(2)).toBe("Beginner");
    expect(formatSkillLabel(3)).toBe("Intermediate");
    expect(formatSkillLabel(4)).toBe("Advanced");
  });
});
