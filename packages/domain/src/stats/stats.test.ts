import { describe, expect, it } from "vitest";
import {
  applyOutcomeToPlayerStats,
  computeWinRate,
  createEmptyStats,
  recomputeSessionFromMatches,
  type CompletedMatchRecord,
} from "./index.js";

describe("computeWinRate", () => {
  it("uses wins / (wins + losses + draws)", () => {
    expect(computeWinRate(3, 1, 0)).toBe(0.75);
  });

  it("returns null when denominator is zero", () => {
    expect(computeWinRate(0, 0, 0)).toBeNull();
  });

  it("includes draws in denominator", () => {
    expect(computeWinRate(1, 1, 1)).toBeCloseTo(1 / 3);
  });
});

describe("applyOutcomeToPlayerStats", () => {
  it("win/loss updates stats", () => {
    const base = createEmptyStats("p1");
    const winner = applyOutcomeToPlayerStats(base, "team_one_win", "team_one", "team_one");
    expect(winner.wins).toBe(1);
    expect(winner.matchesPlayed).toBe(1);

    const loser = applyOutcomeToPlayerStats(base, "team_one_win", "team_two", "team_one");
    expect(loser.losses).toBe(1);
  });

  it("draw does not count as win", () => {
    const stats = applyOutcomeToPlayerStats(
      createEmptyStats("p1"),
      "draw",
      "team_one",
      null,
    );
    expect(stats.draws).toBe(1);
    expect(stats.wins).toBe(0);
    expect(stats.matchesPlayed).toBe(1);
  });

  it("unscored counts played but not win rate fields", () => {
    const stats = applyOutcomeToPlayerStats(
      createEmptyStats("p1"),
      "unscored",
      "team_one",
      null,
    );
    expect(stats.matchesPlayed).toBe(1);
    expect(stats.wins).toBe(0);
    expect(computeWinRate(stats.wins, stats.losses, stats.draws)).toBeNull();
  });

  it("cancelled has no stat effects", () => {
    const stats = applyOutcomeToPlayerStats(
      createEmptyStats("p1"),
      "cancelled",
      "team_one",
      null,
    );
    expect(stats.matchesPlayed).toBe(0);
  });
});

describe("recomputeSessionFromMatches", () => {
  const initialRatings = new Map([
    ["p1", 3],
    ["p2", 3],
    ["p3", 3],
    ["p4", 3],
  ]);

  it("recomputes stats and rated ratings forward after correction", () => {
    const matches: CompletedMatchRecord[] = [
      {
        id: "m1",
        completedAt: "2026-06-09T18:00:00.000Z",
        outcome: "team_one_win",
        winningTeam: "team_one",
        participants: [
          { playerProfileId: "p1", team: "team_one", ratingBefore: 3 },
          { playerProfileId: "p2", team: "team_one", ratingBefore: 3 },
          { playerProfileId: "p3", team: "team_two", ratingBefore: 3 },
          { playerProfileId: "p4", team: "team_two", ratingBefore: 3 },
        ],
      },
      {
        id: "m2",
        completedAt: "2026-06-09T19:00:00.000Z",
        outcome: "team_two_win",
        winningTeam: "team_two",
        participants: [
          { playerProfileId: "p1", team: "team_one", ratingBefore: 3.05 },
          { playerProfileId: "p2", team: "team_one", ratingBefore: 3.05 },
          { playerProfileId: "p3", team: "team_two", ratingBefore: 2.95 },
          { playerProfileId: "p4", team: "team_two", ratingBefore: 2.95 },
        ],
      },
    ];

    const firstPass = recomputeSessionFromMatches(matches, initialRatings, "rated");
    const corrected: CompletedMatchRecord[] = [
      { ...matches[0]!, outcome: "team_two_win", winningTeam: "team_two" },
      matches[1]!,
    ];
    const secondPass = recomputeSessionFromMatches(corrected, initialRatings, "rated");

    const p1First = firstPass.statsByPlayer.get("p1");
    const p1Second = secondPass.statsByPlayer.get("p1");
    expect(p1First?.wins).not.toBe(p1Second?.wins);
  });

  it("casual session updates stats without rating changes", () => {
    const matches: CompletedMatchRecord[] = [
      {
        id: "m1",
        completedAt: "2026-06-09T18:00:00.000Z",
        outcome: "draw",
        winningTeam: null,
        participants: [
          { playerProfileId: "p1", team: "team_one", ratingBefore: 3 },
          { playerProfileId: "p2", team: "team_one", ratingBefore: 3 },
          { playerProfileId: "p3", team: "team_two", ratingBefore: 3 },
          { playerProfileId: "p4", team: "team_two", ratingBefore: 3 },
        ],
      },
    ];
    const result = recomputeSessionFromMatches(matches, initialRatings, "casual");
    expect(result.statsByPlayer.get("p1")?.draws).toBe(1);
    expect(result.ratingsByPlayer.get("p1")).toBe(3);
  });
});
