import { describe, expect, it } from "vitest";
import {
  buildSuggestion,
  buildSuggestionPool,
  explainSuggestion,
  type MatchSuggestion,
} from "./suggestion.js";
import type { CheckIn, SessionSnapshot } from "../types/index.js";

function makeCheckIn(overrides: Partial<CheckIn> & Pick<CheckIn, "id" | "playerProfileId">): CheckIn {
  return {
    queueStatus: "waiting",
    sessionSkillRating: 3.0,
    arrivalOrder: 1,
    checkedInAt: "2026-06-09T18:00:00.000Z",
    matchesPlayedInSession: 0,
    lastMatchEndedAt: null,
    paymentStatus: "unpaid",
    paymentAmountDue: 250,
    paymentAmountPaid: 0,
    ...overrides,
  };
}

function baseSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    session: {
      id: "session-1",
      status: "active",
      queueMode: "suggested",
      ratingMode: "casual",
    },
    checkIns: [],
    queuedMatches: [],
    matches: [],
    courts: [{ id: "court-1", status: "open", currentMatchId: null }],
    now: "2026-06-09T18:30:00.000Z",
    ...overrides,
  };
}

describe("buildSuggestionPool", () => {
  it("includes four waiting players", () => {
    const checkIns = ["p1", "p2", "p3", "p4"].map((id, index) =>
      makeCheckIn({
        id: `c-${id}`,
        playerProfileId: id,
        arrivalOrder: index + 1,
        checkedInAt: `2026-06-09T18:0${index}:00.000Z`,
      }),
    );
    const pool = buildSuggestionPool(baseSnapshot({ checkIns }));
    expect(pool).toHaveLength(4);
  });

  it("excludes playing and court-assigned players", () => {
    const checkIns = [
      makeCheckIn({ id: "c1", playerProfileId: "p1", queueStatus: "playing" }),
      makeCheckIn({ id: "c2", playerProfileId: "p2" }),
      makeCheckIn({ id: "c3", playerProfileId: "p3" }),
      makeCheckIn({ id: "c4", playerProfileId: "p4" }),
      makeCheckIn({ id: "c5", playerProfileId: "p5" }),
    ];
    const matches = [
      {
        id: "m1",
        courtId: "court-1",
        status: "in_progress" as const,
        outcome: null,
        winningTeam: null,
        startedAt: "2026-06-09T18:10:00.000Z",
        endedAt: null,
        completedAt: null,
        participants: [{ checkInId: "c1", playerProfileId: "p1", team: "team_one" as const }],
      },
    ];
    const pool = buildSuggestionPool(baseSnapshot({ checkIns, matches }));
    expect(pool.map((c) => c.playerProfileId)).not.toContain("p1");
    expect(pool.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps staged players eligible", () => {
    const checkIns = ["p1", "p2", "p3", "p4"].map((id, index) =>
      makeCheckIn({
        id: `c-${id}`,
        playerProfileId: id,
        queueStatus: index === 0 ? "assigned" : "waiting",
        arrivalOrder: index + 1,
      }),
    );
    const queuedMatches = [
      {
        id: "qm1",
        laneId: "lane-1",
        status: "draft" as const,
        participants: [{ checkInId: "c-p1", playerProfileId: "p1" }],
      },
    ];
    const pool = buildSuggestionPool(baseSnapshot({ checkIns, queuedMatches }));
    expect(pool.some((c) => c.playerProfileId === "p1")).toBe(true);
  });

  it("omits suggestionExcluded players", () => {
    const checkIns = ["p1", "p2", "p3", "p4", "p5"].map((id, index) =>
      makeCheckIn({
        id: `c-${id}`,
        playerProfileId: id,
        arrivalOrder: index + 1,
        suggestionExcluded: id === "p1",
      }),
    );
    const pool = buildSuggestionPool(baseSnapshot({ checkIns }));
    expect(pool.some((c) => c.playerProfileId === "p1")).toBe(false);
    expect(pool).toHaveLength(4);
  });

  it("includes resting players when waiting pool is too small", () => {
    const checkIns = [
      makeCheckIn({ id: "c1", playerProfileId: "p1", queueStatus: "waiting" }),
      makeCheckIn({ id: "c2", playerProfileId: "p2", queueStatus: "waiting" }),
      makeCheckIn({ id: "c3", playerProfileId: "p3", queueStatus: "resting" }),
      makeCheckIn({ id: "c4", playerProfileId: "p4", queueStatus: "resting" }),
    ];
    const pool = buildSuggestionPool(baseSnapshot({ checkIns }));
    expect(pool).toHaveLength(4);
  });

  it("returns empty pool for manual queue mode", () => {
    const checkIns = ["p1", "p2", "p3", "p4"].map((id, index) =>
      makeCheckIn({ id: `c-${id}`, playerProfileId: id, arrivalOrder: index + 1 }),
    );
    const pool = buildSuggestionPool(
      baseSnapshot({
        checkIns,
        session: {
          id: "session-1",
          status: "active",
          queueMode: "manual",
          ratingMode: "casual",
        },
      }),
    );
    expect(pool).toHaveLength(0);
  });
});

describe("buildSuggestion", () => {
  it("produces a doubles suggestion for four waiting players", () => {
    const checkIns = ["p1", "p2", "p3", "p4"].map((id, index) =>
      makeCheckIn({
        id: `c-${id}`,
        playerProfileId: id,
        arrivalOrder: index + 1,
        checkedInAt: `2026-06-09T18:0${index}:00.000Z`,
      }),
    );
    const suggestion = buildSuggestion(baseSnapshot({ checkIns }));
    expect(suggestion).not.toBeNull();
    expect(suggestion!.players).toHaveLength(4);
    expect(suggestion!.teamOne.playerProfileIds).toHaveLength(2);
    expect(suggestion!.teamTwo.playerProfileIds).toHaveLength(2);
  });

  it("is deterministic for the same snapshot", () => {
    const checkIns = ["p1", "p2", "p3", "p4", "p5"].map((id, index) =>
      makeCheckIn({
        id: `c-${id}`,
        playerProfileId: id,
        arrivalOrder: index + 1,
        sessionSkillRating: id === "p1" || id === "p2" ? 4.5 : 2.5,
        checkedInAt: `2026-06-09T18:0${index}:00.000Z`,
        matchesPlayedInSession: id === "p5" ? 2 : 0,
      }),
    );
    const snapshot = baseSnapshot({ checkIns });
    const first = buildSuggestion(snapshot);
    const second = buildSuggestion(snapshot);
    expect(first).toEqual(second);
  });

  it("prioritizes longer-waiting players when more than four are available", () => {
    const checkIns = [
      makeCheckIn({
        id: "c1",
        playerProfileId: "late",
        arrivalOrder: 5,
        checkedInAt: "2026-06-09T18:25:00.000Z",
      }),
      makeCheckIn({
        id: "c2",
        playerProfileId: "early-1",
        arrivalOrder: 1,
        checkedInAt: "2026-06-09T18:00:00.000Z",
      }),
      makeCheckIn({
        id: "c3",
        playerProfileId: "early-2",
        arrivalOrder: 2,
        checkedInAt: "2026-06-09T18:02:00.000Z",
      }),
      makeCheckIn({
        id: "c4",
        playerProfileId: "early-3",
        arrivalOrder: 3,
        checkedInAt: "2026-06-09T18:04:00.000Z",
      }),
      makeCheckIn({
        id: "c5",
        playerProfileId: "early-4",
        arrivalOrder: 4,
        checkedInAt: "2026-06-09T18:06:00.000Z",
      }),
    ];
    const suggestion = buildSuggestion(baseSnapshot({ checkIns }));
    const ids = suggestion!.players.map((p) => p.playerProfileId);
    expect(ids).not.toContain("late");
  });

  it("balances teams when high-rated pair alternative exists", () => {
    const checkIns = [
      makeCheckIn({ id: "c1", playerProfileId: "a", sessionSkillRating: 4.8, arrivalOrder: 1 }),
      makeCheckIn({ id: "c2", playerProfileId: "b", sessionSkillRating: 4.7, arrivalOrder: 2 }),
      makeCheckIn({ id: "c3", playerProfileId: "c", sessionSkillRating: 2.0, arrivalOrder: 3 }),
      makeCheckIn({ id: "c4", playerProfileId: "d", sessionSkillRating: 2.1, arrivalOrder: 4 }),
    ];
    const suggestion = buildSuggestion(baseSnapshot({ checkIns })) as MatchSuggestion;
    const teamOne = suggestion.teamOne.playerProfileIds.sort().join(",");
    const stacked = ["a", "b"].sort().join(",");
    expect(teamOne).not.toBe(stacked);
  });

  it("returns null for manual queue mode", () => {
    const checkIns = ["p1", "p2", "p3", "p4"].map((id, index) =>
      makeCheckIn({ id: `c-${id}`, playerProfileId: id, arrivalOrder: index + 1 }),
    );
    const suggestion = buildSuggestion(
      baseSnapshot({
        checkIns,
        session: {
          id: "session-1",
          status: "active",
          queueMode: "manual",
          ratingMode: "casual",
        },
      }),
    );
    expect(suggestion).toBeNull();
  });

  it("explainSuggestion returns readable text", () => {
    const suggestion: MatchSuggestion = {
      teamOne: { playerProfileIds: ["a", "b"] },
      teamTwo: { playerProfileIds: ["c", "d"] },
      players: [],
      score: {
        waitPriority: 1,
        teamBalance: 1,
        arrivalFairness: 1,
        repeatPenalty: 0,
        restPenalty: 0,
        total: 3,
      },
    };
    expect(explainSuggestion(suggestion)).toContain("score 3.00");
  });
});
