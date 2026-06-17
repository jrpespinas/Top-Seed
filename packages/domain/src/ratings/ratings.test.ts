import { describe, expect, it } from "vitest";
import {
  applyRatingDelta,
  clampRating,
  computeDrawRatingDeltas,
  computeMatchRatingDeltas,
  computeWinLossRatingDeltas,
  shouldApplyRatingChanges,
} from "./index.js";

describe("clampRating", () => {
  it("clamps below minimum", () => {
    expect(clampRating(0.5)).toBe(1.0);
  });

  it("clamps above maximum", () => {
    expect(clampRating(6.0)).toBe(5.0);
  });
});

describe("win/loss rating deltas", () => {
  it("even-team win changes ratings slightly", () => {
    const deltas = computeWinLossRatingDeltas(
      { teamOneRatings: [3, 3], teamTwoRatings: [3, 3] },
      "team_one",
    );
    expect(deltas.teamOneDeltas[0]).toBe(0.05);
    expect(deltas.teamTwoDeltas[0]).toBe(-0.05);
  });

  it("underdog win changes ratings more than favored win", () => {
    const underdog = computeWinLossRatingDeltas(
      { teamOneRatings: [2, 2], teamTwoRatings: [4, 4] },
      "team_one",
    );
    const favored = computeWinLossRatingDeltas(
      { teamOneRatings: [4, 4], teamTwoRatings: [2, 2] },
      "team_one",
    );
    expect(underdog.teamOneDeltas[0]).toBeGreaterThan(favored.teamOneDeltas[0]!);
  });

  it("casual session does not apply rating changes", () => {
    expect(shouldApplyRatingChanges("casual", "team_one_win")).toBe(false);
  });

  it("unscored does not apply rating changes", () => {
    expect(shouldApplyRatingChanges("rated", "unscored")).toBe(false);
  });

  it("cancelled does not apply rating changes", () => {
    expect(shouldApplyRatingChanges("rated", "cancelled")).toBe(false);
  });
});

describe("draw rating deltas", () => {
  it("even draw is near zero", () => {
    const deltas = computeDrawRatingDeltas({
      teamOneRatings: [3, 3],
      teamTwoRatings: [3, 3],
    });
    expect(deltas.teamOneDeltas[0]).toBe(0);
    expect(deltas.teamTwoDeltas[0]).toBe(0);
  });

  it("lower-rated team gains on draw upset", () => {
    const deltas = computeDrawRatingDeltas({
      teamOneRatings: [2, 2],
      teamTwoRatings: [4, 4],
    });
    expect(deltas.teamOneDeltas[0]).toBeGreaterThan(0);
    expect(deltas.teamTwoDeltas[0]).toBeLessThan(0);
    expect(Math.abs(deltas.teamOneDeltas[0]!)).toBeLessThanOrEqual(0.03);
  });
});

describe("computeMatchRatingDeltas", () => {
  it("rated win returns deltas", () => {
    const deltas = computeMatchRatingDeltas(
      "rated",
      "team_one_win",
      { teamOneRatings: [3, 3], teamTwoRatings: [3, 3] },
      "team_one",
    );
    expect(deltas).not.toBeNull();
  });

  it("casual win returns null", () => {
    const deltas = computeMatchRatingDeltas(
      "casual",
      "team_one_win",
      { teamOneRatings: [3, 3], teamTwoRatings: [3, 3] },
      "team_one",
    );
    expect(deltas).toBeNull();
  });

  it("applyRatingDelta clamps result", () => {
    expect(applyRatingDelta(4.95, 0.1)).toBe(5.0);
  });
});
