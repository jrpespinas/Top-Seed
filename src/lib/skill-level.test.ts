import { describe, it, expect } from "vitest";
import {
  SKILL_LEVELS,
  SKILL_RANK,
  isAdjacentLevel,
  migrateSkillLevel,
  migrateSkillLevelsDeep,
} from "./skill-level";
import type { SkillLevel } from "@/types";

describe("migrateSkillLevel", () => {
  // The whole point of the 7 -> 4 collapse: every value ever written to
  // localStorage has to land somewhere valid, or it reaches the badge as an
  // undefined variant and the matchup scorer as a NaN rank.
  it.each([
    ["S", "ADVANCED"],
    ["A", "ADVANCED"],
    ["B", "INTERMEDIATE"],
    ["C", "INTERMEDIATE"],
    ["D", "BEGINNER"],
    ["E", "BEGINNER"],
    ["F", "CASUAL"],
  ])("maps legacy %s to %s", (legacy, expected) => {
    expect(migrateSkillLevel(legacy)).toBe(expected);
  });

  it("is idempotent — already-migrated values pass through untouched", () => {
    for (const level of SKILL_LEVELS) expect(migrateSkillLevel(level)).toBe(level);
  });

  it("never throws on junk, and lands mid-ladder", () => {
    for (const junk of [undefined, null, 42, "", "Z", {}, []]) {
      expect(migrateSkillLevel(junk)).toBe("INTERMEDIATE");
    }
  });
});

describe("migrateSkillLevelsDeep", () => {
  it("reaches skillLevel at every depth a stored blob buries it", () => {
    const stored = {
      queue: [{ player: { id: "p1", skillLevel: "S" } }],
      courts: [{ activeMatch: { sideA: [{ id: "p2", skillLevel: "D" }], sideB: [{ id: "p3", skillLevel: "F" }] } }],
      cards: [{ suggestion: { sideA: [null, { id: "p4", skillLevel: "B" }] } }],
    };
    const out = migrateSkillLevelsDeep(stored);
    expect(out.queue[0].player.skillLevel).toBe("ADVANCED");
    expect(out.courts[0].activeMatch.sideA[0].skillLevel).toBe("BEGINNER");
    expect(out.courts[0].activeMatch.sideB[0].skillLevel).toBe("CASUAL");
    expect(out.cards[0].suggestion.sideA[1]!.skillLevel).toBe("INTERMEDIATE");
  });

  it("returns the same reference when nothing needed migrating", () => {
    // Guards against handing React a fresh object on every read.
    const clean = { queue: [{ player: { id: "p1", skillLevel: "ADVANCED" } }] };
    expect(migrateSkillLevelsDeep(clean)).toBe(clean);
  });

  it("survives nulls and primitives inside the tree", () => {
    const blob = { a: null, b: 3, c: "x", d: [null, { skillLevel: "E" }] };
    const out = migrateSkillLevelsDeep(blob) as typeof blob;
    expect(out.d[1]).toEqual({ skillLevel: "BEGINNER" });
  });
});

describe("isAdjacentLevel", () => {
  it("is symmetric", () => {
    for (const a of SKILL_LEVELS) {
      for (const b of SKILL_LEVELS) {
        expect(isAdjacentLevel(a, b)).toBe(isAdjacentLevel(b, a));
      }
    }
  });

  it("permits exactly one rung either way", () => {
    const reach = (l: SkillLevel) => SKILL_LEVELS.filter((o) => isAdjacentLevel(l, o)).sort();
    expect(reach("ADVANCED")).toEqual(["ADVANCED", "INTERMEDIATE"]);
    expect(reach("INTERMEDIATE")).toEqual(["ADVANCED", "BEGINNER", "INTERMEDIATE"]);
    expect(reach("BEGINNER")).toEqual(["BEGINNER", "CASUAL", "INTERMEDIATE"]);
    expect(reach("CASUAL")).toEqual(["BEGINNER", "CASUAL"]);
  });

  it("never lets Advanced reach Beginner or Casual", () => {
    expect(isAdjacentLevel("ADVANCED", "BEGINNER")).toBe(false);
    expect(isAdjacentLevel("ADVANCED", "CASUAL")).toBe(false);
  });

  it("ranks strongest first and contiguously", () => {
    expect(SKILL_LEVELS.map((l) => SKILL_RANK[l])).toEqual([1, 2, 3, 4]);
  });
});
