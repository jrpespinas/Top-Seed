import { describe, it, expect } from "vitest";
import {
  computeRosterStats,
  rotationSummary,
  median,
  LAGGARD_GAP,
  computeWaitingStats,
  flowSummary,
  DEFAULT_LONG_WAIT_MS,
  type RosterPlayer,
  type QueueWaitSource,
} from "./player-stats";
import type { Gender, PaymentStatus, SkillLevel } from "@/types";

function player(
  id: string,
  skillLevel: SkillLevel = "INTERMEDIATE",
  gender: Gender | undefined = "M",
  paymentStatus: PaymentStatus = "UNPAID"
): RosterPlayer {
  return { id, name: id, skillLevel, gender, paymentStatus };
}

/** Everyone on the same number of matches, so rotation never skews a test. */
function evenGames(players: RosterPlayer[], games = 3): Map<string, number> {
  return new Map(players.map((p) => [p.id, games]));
}

describe("skill mix", () => {
  it("reports every tier strongest-first, including empty ones", () => {
    const roster = [player("a", "ADVANCED"), player("b", "CASUAL"), player("c", "CASUAL")];
    const { bySkill } = computeRosterStats(roster, evenGames(roster));
    expect(bySkill.map((s) => s.level)).toEqual([
      "ADVANCED",
      "INTERMEDIATE",
      "BEGINNER",
      "CASUAL",
    ]);
    expect(bySkill.map((s) => s.count)).toEqual([1, 0, 0, 2]);
  });

  it("counts every player exactly once", () => {
    const roster = ["a", "b", "c", "d", "e"].map((id) => player(id));
    const { bySkill, total } = computeRosterStats(roster, evenGames(roster));
    expect(bySkill.reduce((sum, s) => sum + s.count, 0)).toBe(total);
  });
});

describe("gender mix", () => {
  it("splits M and F", () => {
    const roster = [player("a", "INTERMEDIATE", "M"), player("b", "INTERMEDIATE", "F")];
    const { byGender } = computeRosterStats(roster, evenGames(roster));
    expect(byGender).toEqual([
      { gender: "M", count: 1 },
      { gender: "F", count: 1 },
    ]);
  });

  // A permanent empty "unspecified" segment would imply the roster is
  // incomplete when it isn't.
  it("adds an unspecified slice only when someone has no gender", () => {
    const withAll = [player("a", "INTERMEDIATE", "M")];
    expect(computeRosterStats(withAll, evenGames(withAll)).byGender).toHaveLength(2);

    // Built literally: passing `undefined` for gender would hit the helper's
    // parameter default and silently produce an "M".
    const noGender: RosterPlayer = {
      id: "b",
      name: "b",
      skillLevel: "INTERMEDIATE",
      paymentStatus: "UNPAID",
    };
    const withMissing = [player("a", "INTERMEDIATE", "M"), noGender];
    const slices = computeRosterStats(withMissing, evenGames(withMissing)).byGender;
    expect(slices).toHaveLength(3);
    expect(slices[2]).toEqual({ gender: null, count: 1 });
  });
});

describe("payment", () => {
  it("counts each state and settles paid plus waived", () => {
    const roster = [
      player("a", "INTERMEDIATE", "M", "PAID"),
      player("b", "INTERMEDIATE", "M", "PAID"),
      player("c", "INTERMEDIATE", "M", "WAIVED"),
      player("d", "INTERMEDIATE", "M", "UNPAID"),
    ];
    const { payment } = computeRosterStats(roster, evenGames(roster));
    expect(payment).toEqual({ paid: 2, waived: 1, unpaid: 1, settled: 3 });
  });

  // Waived is settled, not owed — an organiser chasing money should never be
  // sent after someone whose fee they deliberately dropped.
  it("does not leave a waived player in the chase list", () => {
    const roster = [player("a", "INTERMEDIATE", "M", "WAIVED")];
    const { payment } = computeRosterStats(roster, evenGames(roster));
    expect(payment.unpaid).toBe(0);
    expect(payment.settled).toBe(1);
  });
});

describe("rotation", () => {
  it("buckets players by games played, including empty buckets in between", () => {
    const roster = ["a", "b", "c", "d"].map((id) => player(id));
    const games = new Map([
      ["a", 0],
      ["b", 0],
      ["c", 3],
      ["d", 3],
    ]);
    const { rotation } = computeRosterStats(roster, games);
    expect(rotation.buckets).toEqual([
      { games: 0, count: 2 },
      { games: 1, count: 0 },
      { games: 2, count: 0 },
      { games: 3, count: 2 },
    ]);
  });

  it("calls a tight spread even", () => {
    const roster = ["a", "b", "c", "d", "e"].map((id) => player(id));
    const games = new Map([
      ["a", 3],
      ["b", 3],
      ["c", 4],
      ["d", 4],
      ["e", 3],
    ]);
    const { rotation } = computeRosterStats(roster, games);
    expect(rotation.verdict).toBe("even");
    expect(rotation.laggards).toHaveLength(0);
    expect(rotationSummary(rotation)).toBe("Everyone played 3–4");
  });

  it("names the players who fell behind", () => {
    const roster = ["a", "b", "c", "d", "e"].map((id) => player(id));
    const games = new Map([
      ["a", 5],
      ["b", 5],
      ["c", 5],
      ["d", 5],
      ["e", 1],
    ]);
    const { rotation } = computeRosterStats(roster, games);
    expect(rotation.median).toBe(5);
    expect(rotation.verdict).toBe("uneven");
    expect(rotation.laggards.map((p) => p.id)).toEqual(["e"]);
    expect(rotationSummary(rotation)).toBe("1 player well behind the rest");
  });

  // A late arrival always trails; that is not the rotation failing. The gap
  // has to be wide enough to be worth walking over about.
  it("does not flag someone only one match behind", () => {
    const roster = ["a", "b", "c", "d"].map((id) => player(id));
    const games = new Map([
      ["a", 4],
      ["b", 4],
      ["c", 4],
      ["d", 3],
    ]);
    const { rotation } = computeRosterStats(roster, games);
    expect(rotation.verdict).toBe("even");
    expect(LAGGARD_GAP).toBe(2);
  });

  it("flags a player who never got on court at all", () => {
    const roster = ["a", "b", "c", "d"].map((id) => player(id));
    const games = new Map([
      ["a", 4],
      ["b", 4],
      ["c", 4],
      ["d", 0],
    ]);
    const { rotation } = computeRosterStats(roster, games);
    expect(rotation.laggards.map((p) => p.id)).toEqual(["d"]);
  });

  it("treats a player missing from the games map as zero", () => {
    const roster = ["a", "b", "c", "d"].map((id) => player(id));
    const { rotation } = computeRosterStats(roster, new Map([["a", 4]]));
    expect(rotation.min).toBe(0);
    expect(rotation.max).toBe(4);
  });

  // Below four players the median describes noise, not a field.
  it("withholds a verdict on a tiny roster", () => {
    const roster = ["a", "b"].map((id) => player(id));
    const games = new Map([
      ["a", 6],
      ["b", 0],
    ]);
    const { rotation } = computeRosterStats(roster, games);
    expect(rotation.verdict).toBe("insufficient");
    expect(rotationSummary(rotation)).toBe("Not enough players to judge");
  });

  it("survives an empty roster", () => {
    const stats = computeRosterStats([], new Map());
    expect(stats.total).toBe(0);
    expect(stats.rotation.buckets).toEqual([]);
    expect(stats.rotation.verdict).toBe("insufficient");
  });

  it("reads a session where everyone played the same as a single number", () => {
    const roster = ["a", "b", "c", "d"].map((id) => player(id));
    const { rotation } = computeRosterStats(roster, evenGames(roster, 2));
    expect(rotationSummary(rotation)).toBe("Everyone played 2");
  });
});

describe("median", () => {
  it("takes the middle of an odd set and the mean of the middle two of an even set", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("waiting", () => {
  const NOW = Date.parse("2026-09-04T20:00:00.000Z");
  const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

  function entry(id: string, minutes: number, isInMatch = false): QueueWaitSource {
    return {
      player: { id, name: id, skillLevel: "INTERMEDIATE" },
      isInMatch,
      enteredQueueAt: minutesAgo(minutes),
    };
  }

  it("averages the waits and names the longest", () => {
    const stats = computeWaitingStats([entry("a", 2), entry("b", 6), entry("c", 4)], NOW);
    expect(stats.averageMs).toBe(4 * 60_000);
    expect(stats.longest?.id).toBe("b");
    expect(stats.waiting.map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  // Their enteredQueueAt is a stale timestamp from before they were pulled;
  // counting it would report a wait that already ended.
  it("excludes players already on court", () => {
    const stats = computeWaitingStats([entry("a", 2), entry("onCourt", 40, true)], NOW);
    expect(stats.waiting.map((w) => w.id)).toEqual(["a"]);
    expect(stats.averageMs).toBe(2 * 60_000);
  });

  // Null, not zero: nobody waiting is a different fact from a wait of zero.
  it("returns null when nobody is waiting", () => {
    expect(computeWaitingStats([], NOW).averageMs).toBeNull();
    expect(computeWaitingStats([entry("a", 5, true)], NOW).longest).toBeNull();
  });

  it("clamps a future timestamp to zero rather than reporting a negative wait", () => {
    const stats = computeWaitingStats([entry("a", -3)], NOW);
    expect(stats.waiting[0].waitedMs).toBe(0);
  });

  it("keeps the ordering stable enough to name one longest", () => {
    const stats = computeWaitingStats([entry("a", 5), entry("b", 5)], NOW);
    expect(stats.longest).not.toBeNull();
    expect(stats.averageMs).toBe(5 * 60_000);
  });
});

describe("wait distribution and flow", () => {
  const NOW = Date.parse("2026-09-04T20:00:00.000Z");
  const MATCH = 20 * 60_000;
  function q(id: string, minutes: number): QueueWaitSource {
    return {
      player: { id, name: id, skillLevel: "INTERMEDIATE" },
      isInMatch: false,
      enteredQueueAt: new Date(NOW - minutes * 60_000).toISOString(),
    };
  }

  it("buckets waits on fixed five-minute edges with an open final bucket", () => {
    const stats = computeWaitingStats(
      [q("a", 1), q("b", 6), q("c", 7), q("d", 12), q("e", 33)],
      NOW,
      MATCH
    );
    expect(stats.buckets.map((b) => b.count)).toEqual([1, 2, 1, 0, 1]);
    expect(stats.buckets.map((b) => b.fromMin)).toEqual([0, 5, 10, 15, 20]);
    expect(stats.buckets[4].toMin).toBeNull();
  });

  it("counts every waiting player exactly once", () => {
    const entries = [q("a", 0), q("b", 5), q("c", 15), q("d", 20), q("e", 99)];
    const stats = computeWaitingStats(entries, NOW, MATCH);
    expect(stats.buckets.reduce((n, b) => n + b.count, 0)).toBe(stats.waiting.length);
  });

  // Twelve minutes is fine where matches run 25 and bad where they run 8, so a
  // fixed constant can't answer this.
  it("draws the long-wait line at one median match", () => {
    const entries = [q("a", 12)];
    expect(computeWaitingStats(entries, NOW, 25 * 60_000).verdict).toBe("flowing");
    expect(computeWaitingStats(entries, NOW, 8 * 60_000).verdict).toBe("backed-up");
  });

  it("falls back to a constant before the session knows its own pace", () => {
    const stats = computeWaitingStats([q("a", 20)], NOW, null);
    expect(stats.longWaitMs).toBe(DEFAULT_LONG_WAIT_MS);
    expect(stats.verdict).toBe("backed-up");
  });

  it("names how many are stuck", () => {
    const stats = computeWaitingStats([q("a", 30), q("b", 25), q("c", 2)], NOW, MATCH);
    expect(stats.stuck.map((w) => w.id)).toEqual(["a", "b"]);
    expect(flowSummary(stats)).toBe("2 waiting longer than a match");
  });

  it("reads an idle queue as idle, not as flowing perfectly", () => {
    const stats = computeWaitingStats([], NOW, MATCH);
    expect(stats.verdict).toBe("idle");
    expect(flowSummary(stats)).toBe("Nobody in the queue");
    expect(stats.buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("summarises a healthy queue by its longest wait", () => {
    expect(flowSummary(computeWaitingStats([q("a", 3), q("b", 1)], NOW, MATCH))).toBe(
      "Everyone under 4m"
    );
  });
});
