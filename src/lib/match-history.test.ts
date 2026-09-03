import { describe, it, expect } from "vitest";
import {
  matchDurationMs,
  formatDurationMs,
  longMatchThresholdMs,
  computeSessionRecap,
  outcomeForPlayer,
  playerSide,
  findSearchedPlayer,
  median,
} from "./match-history";
import { matchUpset } from "./leaderboard";
import type { MatchRecord, MatchResult, Player, SkillLevel } from "@/types";

function player(id: string, skillLevel: SkillLevel = "INTERMEDIATE", name = id): Player {
  return { id, name, skillLevel, paymentStatus: "UNPAID" };
}

let seq = 0;
function match(
  sideA: Player[],
  sideB: Player[],
  result: MatchResult | null,
  minutes = 20,
  overrides: Partial<MatchRecord> = {}
): MatchRecord {
  seq++;
  const start = new Date(Date.UTC(2026, 8, 3, 18, 0) + seq * 3_600_000);
  return {
    id: `m${seq}`,
    sessionId: "s1",
    courtName: "Court 1",
    matchType: sideA.length > 1 ? "DOUBLES" : "SINGLES",
    sideA,
    sideB,
    result,
    status: "COMPLETED",
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
    ...overrides,
  };
}

describe("duration", () => {
  it("measures start to end", () => {
    expect(matchDurationMs(match([player("a")], [player("b")], "SIDE_A", 24))).toBe(24 * 60_000);
  });

  // A match voided straight from in-progress never got an endedAt. "0m" would
  // read as a real, absurdly short match rather than as an absence.
  it("returns null rather than zero when the match never ended", () => {
    const m = match([player("a")], [player("b")], null, 20, { endedAt: null, status: "VOIDED" });
    expect(matchDurationMs(m)).toBeNull();
  });

  it("returns null for a non-positive span rather than a negative duration", () => {
    const m = match([player("a")], [player("b")], "SIDE_A", 20);
    expect(matchDurationMs({ ...m, endedAt: m.startedAt })).toBeNull();
  });

  it.each([
    [60_000, "1m"],
    [24 * 60_000, "24m"],
    [59 * 60_000, "59m"],
    [64 * 60_000, "1h 04m"],
    [125 * 60_000, "2h 05m"],
  ])("formats %ims as %s", (ms, expected) => {
    expect(formatDurationMs(ms)).toBe(expected);
  });

  it("never formats a real duration as 0m", () => {
    expect(formatDurationMs(20_000)).toBe("1m");
  });
});

describe("median and the long-match threshold", () => {
  it("takes the middle of an odd set and the mean of the middle two of an even set", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  // Null means "nothing is long", not "everything is" — two matches aren't a
  // baseline to be unusual against.
  it("refuses to produce a threshold from fewer than three matches", () => {
    const twenty = 20 * 60_000;
    expect(longMatchThresholdMs([twenty, twenty])).toBeNull();
    expect(longMatchThresholdMs([twenty, twenty, twenty])).not.toBeNull();
  });

  it("scales with the session rather than a constant", () => {
    const short = [8, 10, 12].map((m) => m * 60_000);
    const long = [40, 50, 60].map((m) => m * 60_000);
    expect(longMatchThresholdMs(long)!).toBeGreaterThan(longMatchThresholdMs(short)!);
  });

  it("holds a floor so a fast session doesn't flag ordinary matches", () => {
    // Median 2m × 1.5 = 3m, which would mark a routine 5-minute match as long.
    const rapid = [1, 2, 3].map((m) => m * 60_000);
    expect(longMatchThresholdMs(rapid)).toBe(10 * 60_000);
  });
});

describe("session recap", () => {
  it("counts only completed matches", () => {
    const [a, b] = [player("a"), player("b")];
    const recap = computeSessionRecap([
      match([a], [b], "SIDE_A"),
      match([a], [b], "SIDE_A", 20, { status: "VOIDED", result: null }),
      match([a], [b], null, 20, { status: "IN_PROGRESS" }),
    ]);
    expect(recap.matchesPlayed).toBe(1);
  });

  it("finds the longest match", () => {
    const [a, b] = [player("a"), player("b")];
    const recap = computeSessionRecap([
      match([a], [b], "SIDE_A", 12),
      match([a], [b], "SIDE_A", 41),
      match([a], [b], "SIDE_A", 25),
    ]);
    expect(recap.longest?.durationMs).toBe(41 * 60_000);
  });

  // Two courts running at once means more court time than wall-clock time.
  it("sums court time across parallel courts rather than capping at the span", () => {
    const [a, b] = [player("a"), player("b")];
    const start = new Date(Date.UTC(2026, 8, 3, 18, 0));
    const parallel = (id: string): MatchRecord => ({
      ...match([a], [b], "SIDE_A", 30),
      id,
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
    });
    const recap = computeSessionRecap([parallel("x"), parallel("y")]);
    expect(recap.totalCourtTimeMs).toBe(60 * 60_000);
    expect(recap.spanMs).toBe(30 * 60_000);
  });

  it("counts upsets with the same definition the leaderboard uses", () => {
    const casual = player("cas", "CASUAL");
    const advanced = player("adv", "ADVANCED");
    const upset = match([casual], [advanced], "SIDE_A");
    const routine = match([advanced], [casual], "SIDE_A");
    expect(matchUpset(upset)).not.toBeNull();
    expect(matchUpset(routine)).toBeNull();
    expect(computeSessionRecap([upset, routine]).upsetCount).toBe(1);
  });

  it("survives a set with no ended matches", () => {
    const [a, b] = [player("a"), player("b")];
    const recap = computeSessionRecap([
      match([a], [b], "SIDE_A", 20, { endedAt: null }),
    ]);
    expect(recap.matchesPlayed).toBe(1);
    expect(recap.longest).toBeNull();
    expect(recap.spanMs).toBeNull();
    expect(recap.totalCourtTimeMs).toBe(0);
    expect(recap.longMatchThresholdMs).toBeNull();
  });

  it("survives an empty set", () => {
    const recap = computeSessionRecap([]);
    expect(recap.matchesPlayed).toBe(0);
    expect(recap.longest).toBeNull();
    expect(recap.upsetCount).toBe(0);
  });
});

describe("outcome framed for a player", () => {
  const a1 = player("a1");
  const a2 = player("a2");
  const b1 = player("b1");
  const b2 = player("b2");

  it("reads a win from either side", () => {
    expect(outcomeForPlayer(match([a1, a2], [b1, b2], "SIDE_A"), "a1")).toBe("win");
    expect(outcomeForPlayer(match([a1, a2], [b1, b2], "SIDE_B"), "b1")).toBe("win");
  });

  it("reads a loss from either side", () => {
    expect(outcomeForPlayer(match([a1, a2], [b1, b2], "SIDE_B"), "a1")).toBe("loss");
    expect(outcomeForPlayer(match([a1, a2], [b1, b2], "SIDE_A"), "b1")).toBe("loss");
  });

  it("reads a draw as a draw for everyone", () => {
    const m = match([a1, a2], [b1, b2], "DRAW");
    expect(outcomeForPlayer(m, "a1")).toBe("draw");
    expect(outcomeForPlayer(m, "b1")).toBe("draw");
  });

  it("returns null for a player who wasn't in the match, or a voided one", () => {
    expect(outcomeForPlayer(match([a1], [b1], "SIDE_A"), "nobody")).toBeNull();
    expect(
      outcomeForPlayer(match([a1], [b1], "SIDE_A", 20, { status: "VOIDED", result: null }), "a1")
    ).toBeNull();
  });

  it("locates which side a player was on", () => {
    const m = match([a1, a2], [b1, b2], "SIDE_A");
    expect(playerSide(m, "a2")).toBe("A");
    expect(playerSide(m, "b2")).toBe("B");
    expect(playerSide(m, "nobody")).toBeNull();
  });
});

describe("search", () => {
  const tita = player("p1", "ADVANCED", "Tita Roochie");
  const karl = player("p2", "CASUAL", "Karl");

  it("matches on a substring, case-insensitively", () => {
    const matches = [match([tita], [karl], "SIDE_A")];
    expect(findSearchedPlayer(matches, "roochie")?.id).toBe("p1");
    expect(findSearchedPlayer(matches, "KARL")?.id).toBe("p2");
  });

  it("returns null for a blank query or no hit", () => {
    const matches = [match([tita], [karl], "SIDE_A")];
    expect(findSearchedPlayer(matches, "   ")).toBeNull();
    expect(findSearchedPlayer(matches, "nobody")).toBeNull();
  });

  // A stable pick matters: the searched player is the frame of reference for
  // every win/loss badge on the page, so it must not flicker between renders.
  it("resolves an ambiguous query to the same player every time", () => {
    const kara = player("p3", "BEGINNER", "Karina");
    const matches = [match([karl], [kara], "SIDE_A")];
    const first = findSearchedPlayer(matches, "kar");
    expect(findSearchedPlayer(matches, "kar")?.id).toBe(first?.id);
  });
});
