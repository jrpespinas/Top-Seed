import { describe, it, expect } from "vitest";
import {
  computeLeaderboard,
  selectHonors,
  championSummary,
  type LeaderboardSort,
  type MatchTypeFilter,
} from "./leaderboard";
import type { MatchRecord, MatchResult, MatchType, Player, SkillLevel } from "@/types";

function player(id: string, skillLevel: SkillLevel = "INTERMEDIATE"): Player {
  return { id, name: id, skillLevel, paymentStatus: "UNPAID" };
}

let matchSeq = 0;
function match(
  sideA: Player[],
  sideB: Player[],
  result: MatchResult | null,
  overrides: Partial<MatchRecord> = {}
): MatchRecord {
  matchSeq++;
  return {
    id: `m${matchSeq}`,
    sessionId: "s1",
    courtName: "Court 1",
    matchType: (sideA.length > 1 ? "DOUBLES" : "SINGLES") as MatchType,
    sideA,
    sideB,
    result,
    status: "COMPLETED",
    // Padded so lexicographic ISO ordering matches numeric order past 9.
    startedAt: `2026-09-03T${String(matchSeq).padStart(2, "0")}:00:00.000Z`,
    endedAt: `2026-09-03T${String(matchSeq).padStart(2, "0")}:20:00.000Z`,
    ...overrides,
  };
}

type Options = { matchType: MatchTypeFilter; sort: LeaderboardSort };
const ALL: Options = { matchType: "ALL", sort: "points" };

function rowFor(matches: MatchRecord[], id: string, options: Options = ALL) {
  const row = computeLeaderboard(matches, options).find((r) => r.playerId === id);
  if (!row) throw new Error(`no row for ${id}`);
  return row;
}

describe("points", () => {
  it("scores a clean win at 3 and a draw at 1", () => {
    const [a, b] = [player("a"), player("b")];
    const rows = computeLeaderboard([match([a], [b], "SIDE_A"), match([a], [b], "DRAW")], ALL);
    expect(rows.find((r) => r.playerId === "a")!.resultPoints).toBe(4);
    expect(rows.find((r) => r.playerId === "b")!.resultPoints).toBe(1);
  });

  // The bug this redesign was built to fix: winRate divided by a denominator
  // that counted draws, and the Wilson bound took (wins, played) directly, so
  // an undefeated record and a beaten one came out identical and tied.
  it("separates an undefeated record from a beaten one with the same win count", () => {
    const [ace, sherell, x, y] = ["ace", "sherell", "x", "y"].map((id) => player(id));
    const undefeated = [
      match([ace], [x], "SIDE_A"),
      match([ace], [y], "SIDE_A"),
      match([ace], [x], "SIDE_A"),
      match([ace], [y], "DRAW"),
    ];
    const beaten = [
      match([sherell], [x], "SIDE_A"),
      match([sherell], [y], "SIDE_A"),
      match([sherell], [x], "SIDE_A"),
      match([sherell], [y], "SIDE_B"),
    ];
    const rows = computeLeaderboard([...undefeated, ...beaten], ALL);
    const aceRow = rows.find((r) => r.playerId === "ace")!;
    const sherellRow = rows.find((r) => r.playerId === "sherell")!;
    expect(aceRow.points).toBeGreaterThan(sherellRow.points);
    expect(aceRow.form).toBeGreaterThan(sherellRow.form);
    expect(aceRow.rank).toBeLessThan(sherellRow.rank);
  });

  it("ignores voided and in-progress matches", () => {
    const [a, b] = [player("a"), player("b")];
    const rows = computeLeaderboard(
      [
        match([a], [b], "SIDE_A"),
        match([a], [b], "SIDE_A", { status: "VOIDED" }),
        match([a], [b], null, { status: "IN_PROGRESS" }),
      ],
      ALL
    );
    expect(rows.find((r) => r.playerId === "a")!.matchesPlayed).toBe(1);
  });

  it("respects the match-type filter", () => {
    const [a, b, c, d] = ["a", "b", "c", "d"].map((id) => player(id));
    const matches = [match([a], [b], "SIDE_A"), match([a, c], [b, d], "SIDE_A")];
    expect(rowFor(matches, "a", { matchType: "SINGLES", sort: "points" }).matchesPlayed).toBe(1);
    expect(rowFor(matches, "a", { matchType: "DOUBLES", sort: "points" }).matchesPlayed).toBe(1);
    expect(rowFor(matches, "a").matchesPlayed).toBe(2);
  });
});

describe("difficulty bonus", () => {
  it("pays nothing for a win between equals", () => {
    const [a, b] = [player("a"), player("b")];
    expect(rowFor([match([a], [b], "SIDE_A")], "a").bonusPoints).toBe(0);
  });

  it("pays one point per rung punched up", () => {
    const casual = player("casual", "CASUAL");
    const advanced = player("advanced", "ADVANCED");
    // CASUAL rank 4 vs ADVANCED rank 1 — three rungs.
    expect(rowFor([match([casual], [advanced], "SIDE_A")], "casual").bonusPoints).toBe(3);
  });

  it("never pays — or charges — for beating a weaker player", () => {
    const casual = player("casual", "CASUAL");
    const advanced = player("advanced", "ADVANCED");
    const row = rowFor([match([advanced], [casual], "SIDE_A")], "advanced");
    expect(row.bonusPoints).toBe(0);
    expect(row.points).toBe(3);
  });

  // The whole reason bonuses are one-directional: if playing down cost you
  // rating, the strongest players would stop mixing to protect a number.
  it("leaves a strong player's points untouched by who they played", () => {
    const advanced = player("advanced", "ADVANCED");
    const vsWeak = rowFor(
      [match([advanced], [player("c1", "CASUAL")], "SIDE_A")],
      "advanced"
    ).points;
    const vsEqual = rowFor(
      [match([advanced], [player("a2", "ADVANCED")], "SIDE_A")],
      "advanced"
    ).points;
    expect(vsWeak).toBe(vsEqual);
  });

  it("pays carry credit when the underdog pair wins", () => {
    const advanced = player("adv", "ADVANCED");
    const casual = player("cas", "CASUAL");
    const opponents = [player("o1", "ADVANCED"), player("o2", "ADVANCED")];
    // Side avg 2.5 vs 1.0 — underdogs — and the partner is three rungs weaker.
    expect(rowFor([match([advanced, casual], opponents, "SIDE_A")], "adv").bonusPoints).toBe(3);
  });

  // Without the underdog gate, an Advanced player paired with a Casual against
  // two Casuals collects full carry credit for a match they were always
  // going to win.
  it("withholds carry credit when the pair was the favourite", () => {
    const advanced = player("adv", "ADVANCED");
    const casual = player("cas", "CASUAL");
    const opponents = [player("o1", "CASUAL"), player("o2", "CASUAL")];
    expect(rowFor([match([advanced, casual], opponents, "SIDE_A")], "adv").bonusPoints).toBe(0);
  });

  it("caps a single match at three bonus points", () => {
    const casual = player("cas", "CASUAL");
    const partner = player("mate", "CASUAL");
    const opponents = [player("o1", "ADVANCED"), player("o2", "ADVANCED")];
    const row = rowFor([match([casual, partner], opponents, "SIDE_A")], "cas");
    // difficulty 3 + carry 0 would already cap; assert the ceiling holds.
    expect(row.bonusPoints).toBe(3);
    expect(row.points).toBe(6);
  });

  it("pays no bonus for a loss or a draw against stronger opposition", () => {
    const casual = player("cas", "CASUAL");
    const advanced = player("adv", "ADVANCED");
    expect(rowFor([match([casual], [advanced], "SIDE_B")], "cas").bonusPoints).toBe(0);
    expect(rowFor([match([casual], [advanced], "DRAW")], "cas").bonusPoints).toBe(0);
  });
});

describe("form", () => {
  it("starts everyone at 1-1", () => {
    const [a, b] = [player("a"), player("b")];
    // 0 matches never appears in a row, so check the shape via a single draw:
    // (0 + 0.5 + 1) / (1 + 2) = 0.5
    expect(rowFor([match([a], [b], "DRAW")], "a").form).toBeCloseTo(0.5, 5);
  });

  it("reads a perfect small record generously without matching a long one", () => {
    const [a, b] = [player("a"), player("b")];
    const fiveOh = Array.from({ length: 5 }, () => match([a], [b], "SIDE_A"));
    const form = rowFor(fiveOh, "a").form;
    // The number Wilson rendered as 57%.
    expect(form).toBeCloseTo(6 / 7, 5);
    expect(form).toBeGreaterThan(0.85);
  });

  it("still ranks a long record above a short one at the same win rate", () => {
    const [short, long, foil] = [player("short"), player("long"), player("foil")];
    const matches = [
      match([short], [foil], "SIDE_A"),
      match([short], [foil], "SIDE_A"),
      ...Array.from({ length: 20 }, () => match([long], [foil], "SIDE_A")),
      match([long], [foil], "SIDE_B"),
      match([long], [foil], "SIDE_B"),
    ];
    const rows = computeLeaderboard(matches, { matchType: "ALL", sort: "form" });
    expect(rows.find((r) => r.playerId === "long")!.form).toBeGreaterThan(
      rows.find((r) => r.playerId === "short")!.form
    );
  });
});

describe("streaks", () => {
  it("tracks the longest run and the run still alive", () => {
    const [a, b] = [player("a"), player("b")];
    const row = rowFor(
      [
        match([a], [b], "SIDE_A"),
        match([a], [b], "SIDE_A"),
        match([a], [b], "SIDE_A"),
        match([a], [b], "SIDE_B"),
        match([a], [b], "SIDE_A"),
      ],
      "a"
    );
    expect(row.longestStreak).toBe(3);
    expect(row.currentStreak).toBe(1);
  });

  it("breaks a streak on a draw", () => {
    const [a, b] = [player("a"), player("b")];
    const row = rowFor(
      [match([a], [b], "SIDE_A"), match([a], [b], "DRAW"), match([a], [b], "SIDE_A")],
      "a"
    );
    expect(row.longestStreak).toBe(1);
    expect(row.currentStreak).toBe(1);
  });

  // The match log hands records back newest-first; a streak read in that order
  // would be the reverse of what happened.
  it("reads chronologically regardless of input order", () => {
    const [a, b] = [player("a"), player("b")];
    const chronological = [
      match([a], [b], "SIDE_B"),
      match([a], [b], "SIDE_A"),
      match([a], [b], "SIDE_A"),
    ];
    const row = rowFor([...chronological].reverse(), "a");
    expect(row.currentStreak).toBe(2);
  });
});

describe("partners", () => {
  it("needs two matches together before naming a best partner", () => {
    const [a, mate, o1, o2] = ["a", "mate", "o1", "o2"].map((id) => player(id));
    const once = [match([a, mate], [o1, o2], "SIDE_A")];
    expect(rowFor(once, "a").bestPartner).toBeNull();
    const twice = [...once, match([a, mate], [o1, o2], "SIDE_A")];
    expect(rowFor(twice, "a").bestPartner).toMatchObject({ partnerId: "mate", wins: 2, played: 2 });
  });

  it("prefers the partner won with most, not merely played with most", () => {
    const [a, winner, filler, o1, o2] = ["a", "winner", "filler", "o1", "o2"].map((id) => player(id));
    const matches = [
      match([a, winner], [o1, o2], "SIDE_A"),
      match([a, winner], [o1, o2], "SIDE_A"),
      match([a, filler], [o1, o2], "SIDE_B"),
      match([a, filler], [o1, o2], "SIDE_B"),
      match([a, filler], [o1, o2], "SIDE_B"),
    ];
    expect(rowFor(matches, "a").bestPartner!.partnerId).toBe("winner");
  });

  it("never records a singles opponent as a partner", () => {
    const [a, b] = [player("a"), player("b")];
    expect(rowFor([match([a], [b], "SIDE_A"), match([a], [b], "SIDE_A")], "a").bestPartner).toBeNull();
  });
});

describe("ranking", () => {
  it("puts points first and form second", () => {
    // Same points (9), different form: 3-0-1 beats 2-1-2 on the tiebreak.
    const [clean, padded, foil] = [player("clean"), player("padded"), player("foil")];
    const matches = [
      ...Array.from({ length: 3 }, () => match([clean], [foil], "SIDE_A")),
      match([clean], [foil], "SIDE_B"),
      ...Array.from({ length: 2 }, () => match([padded], [foil], "SIDE_A")),
      ...Array.from({ length: 3 }, () => match([padded], [foil], "DRAW")),
    ];
    const rows = computeLeaderboard(matches, ALL);
    expect(rows.find((r) => r.playerId === "clean")!.points).toBe(9);
    expect(rows.find((r) => r.playerId === "padded")!.points).toBe(9);
    expect(rows.find((r) => r.playerId === "clean")!.rank).toBeLessThan(
      rows.find((r) => r.playerId === "padded")!.rank
    );
  });

  it("uses competition ranking and flags genuine ties", () => {
    const [a, b, foil] = [player("a"), player("b"), player("foil")];
    const matches = [
      match([a], [foil], "SIDE_A"),
      match([a], [foil], "SIDE_A"),
      match([b], [foil], "SIDE_A"),
      match([b], [foil], "SIDE_A"),
    ];
    const rows = computeLeaderboard(matches, ALL);
    const tied = rows.filter((r) => r.playerId !== "foil");
    expect(tied.every((r) => r.rank === 1 && r.isTied)).toBe(true);
    // 1, 1, then 3 — never 1, 1, 2.
    expect(rows.find((r) => r.playerId === "foil")!.rank).toBe(3);
  });

  it("honours every sort key", () => {
    const [busy, sharp, foil] = [player("busy"), player("sharp"), player("foil")];
    const matches = [
      ...Array.from({ length: 3 }, () => match([busy], [foil], "SIDE_A")),
      ...Array.from({ length: 4 }, () => match([busy], [foil], "SIDE_B")),
      ...Array.from({ length: 2 }, () => match([sharp], [foil], "SIDE_A")),
    ];
    const first = (sort: "points" | "form" | "wins" | "matchesPlayed") =>
      computeLeaderboard(matches, { matchType: "ALL", sort }).filter((r) => r.playerId !== "foil")[0]
        .playerId;
    expect(first("wins")).toBe("busy");
    expect(first("matchesPlayed")).toBe("busy");
    expect(first("points")).toBe("busy");
    expect(first("form")).toBe("sharp");
  });

  it("returns nothing when no match has completed", () => {
    const [a, b] = [player("a"), player("b")];
    expect(computeLeaderboard([match([a], [b], null, { status: "IN_PROGRESS" })], ALL)).toEqual([]);
    expect(computeLeaderboard([], ALL)).toEqual([]);
  });
});

describe("honors", () => {
  it("never awards an honor to someone already on the podium", () => {
    const [champ, foil, other] = [player("champ"), player("foil"), player("other")];
    const matches = [
      ...Array.from({ length: 5 }, () => match([champ], [foil], "SIDE_A")),
      match([other], [foil], "SIDE_A"),
      match([other], [foil], "SIDE_A"),
    ];
    const rows = computeLeaderboard(matches, ALL);
    const podium = new Set(rows.slice(0, 3).map((r) => r.playerId));
    const honors = selectHonors(rows, 2, podium);
    // The 5-0 champion owns the longest streak by construction; the honor has
    // to fall to someone else or the apex recognises four people, not five.
    expect(honors.every((h) => !podium.has(h.playerId))).toBe(true);
  });

  it("gives one player at most one honor", () => {
    const [a, b, c, foil] = ["a", "b", "c", "foil"].map((id) => player(id));
    const matches = [
      ...Array.from({ length: 4 }, () => match([a], [foil], "SIDE_A")),
      ...Array.from({ length: 3 }, () => match([b], [foil], "SIDE_A")),
      match([c], [foil], "SIDE_A"),
    ];
    const rows = computeLeaderboard(matches, ALL);
    const honors = selectHonors(rows, 2, new Set());
    expect(new Set(honors.map((h) => h.playerId)).size).toBe(honors.length);
  });

  // Adjacency-constrained matchups mean plenty of sessions produce no upset at
  // all; the slot has to fill from further down the pool rather than render empty.
  it("falls through to the next available honor when no upset happened", () => {
    const [a, b, foil] = [player("a"), player("b"), player("foil")];
    const matches = [
      ...Array.from({ length: 3 }, () => match([a], [foil], "SIDE_A")),
      ...Array.from({ length: 2 }, () => match([b], [foil], "SIDE_A")),
    ];
    const honors = selectHonors(computeLeaderboard(matches, ALL), 2, new Set());
    expect(honors.some((h) => h.kind === "upset")).toBe(false);
    expect(honors.length).toBeGreaterThan(0);
    expect(honors.every((h) => h.detail.length > 0)).toBe(true);
  });

  it("returns fewer honors than slots rather than inventing them", () => {
    const [a, b] = [player("a"), player("b")];
    const honors = selectHonors(computeLeaderboard([match([a], [b], "SIDE_A")], ALL), 2, new Set());
    expect(honors.length).toBeLessThanOrEqual(2);
  });

  it("respects the slot count", () => {
    const players = ["a", "b", "c", "d", "e"].map((id) => player(id));
    const foil = player("foil");
    const matches = players.flatMap((p, i) =>
      Array.from({ length: 5 - i }, () => match([p], [foil], "SIDE_A"))
    );
    expect(selectHonors(computeLeaderboard(matches, ALL), 2, new Set()).length).toBe(2);
  });
});

describe("championSummary", () => {
  it("names a perfect record", () => {
    const [a, b] = [player("a"), player("b")];
    const rows = computeLeaderboard(
      Array.from({ length: 5 }, () => match([a], [b], "SIDE_A")),
      ALL
    );
    expect(championSummary(rows[0])).toMatch(/Won all 5/);
  });

  it("names the upset when there was one", () => {
    const casual = player("casual", "CASUAL");
    const advanced = player("Tita", "ADVANCED");
    const rows = computeLeaderboard([match([casual], [advanced], "SIDE_A")], ALL);
    expect(championSummary(rows[0])).toContain("Tita");
  });

  // An empty line reads better than "had a good session".
  it("returns null rather than filler when nothing specific happened", () => {
    const [a, b] = [player("a"), player("b")];
    const rows = computeLeaderboard([match([a], [b], "SIDE_A"), match([a], [b], "SIDE_B")], ALL);
    expect(championSummary(rows.find((r) => r.playerId === "a")!)).toBeNull();
  });
});
