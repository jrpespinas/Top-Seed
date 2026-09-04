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

  // Sequential throughout, never shared places — no "T-" prefix anywhere.
  it("numbers every row sequentially, even on identical records", () => {
    const [zoe, adam, foil] = [player("zoe"), player("adam"), player("foil")];
    const matches = [
      match([zoe], [foil], "SIDE_A"),
      match([zoe], [foil], "SIDE_A"),
      match([adam], [foil], "SIDE_A"),
      match([adam], [foil], "SIDE_A"),
    ];
    const rows = computeLeaderboard(matches, ALL);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  // Of the available answers, check-in is the only one that rewards something
  // the player actually did — and it quietly encourages turning up early.
  it("breaks an identical record on check-in time, earliest first", () => {
    const [zoe, adam, foil] = [player("zoe"), player("adam"), player("foil")];
    const matches = [
      match([zoe], [foil], "SIDE_A"),
      match([zoe], [foil], "SIDE_A"),
      match([adam], [foil], "SIDE_A"),
      match([adam], [foil], "SIDE_A"),
    ];
    const checkInByPlayer = new Map([
      ["adam", "2026-09-04T18:00:00.000Z"],
      ["zoe", "2026-09-04T19:30:00.000Z"],
    ]);
    const rows = computeLeaderboard(matches, { ...ALL, checkInByPlayer });
    const ranked = rows.filter((r) => r.playerId !== "foil").map((r) => r.playerId);
    // Adam checked in earlier despite Zoe appearing first in the match log.
    expect(ranked).toEqual(["adam", "zoe"]);
  });

  // Snapshots taken before `sessionJoinedAt` existed have no check-in at all.
  it("falls back to the first match played when check-in is unknown", () => {
    const [early, late, foil] = [player("early"), player("late"), player("foil")];
    const matches = [
      match([early], [foil], "SIDE_A"),
      match([early], [foil], "SIDE_A"),
      match([late], [foil], "SIDE_A"),
      match([late], [foil], "SIDE_A"),
    ];
    const rows = computeLeaderboard(matches, ALL);
    const ranked = rows.filter((r) => r.playerId !== "foil").map((r) => r.playerId);
    expect(ranked).toEqual(["early", "late"]);
    expect(rows.find((r) => r.playerId === "early")!.checkInAt).toBe(matches[0].startedAt);
  });

  it("prefers a known check-in over the first-match fallback", () => {
    const [known, other, foil] = [player("known"), player("other"), player("foil")];
    const matches = [
      match([other], [foil], "SIDE_A"),
      match([other], [foil], "SIDE_A"),
      match([known], [foil], "SIDE_A"),
      match([known], [foil], "SIDE_A"),
    ];
    // "known" played second, but checked in before the first match started —
    // waiting on the bench shouldn't cost them the tiebreak.
    const checkInByPlayer = new Map([["known", "2026-09-03T00:00:00.000Z"]]);
    const rows = computeLeaderboard(matches, { ...ALL, checkInByPlayer });
    const ranked = rows.filter((r) => r.playerId !== "foil").map((r) => r.playerId);
    expect(ranked[0]).toBe("known");
  });

  it("falls through to name only when check-ins are identical", () => {
    const [zoe, adam, foil] = [player("zoe"), player("adam"), player("foil")];
    const matches = [
      match([zoe], [foil], "SIDE_A"),
      match([zoe], [foil], "SIDE_A"),
      match([adam], [foil], "SIDE_A"),
      match([adam], [foil], "SIDE_A"),
    ];
    const at = "2026-09-04T18:00:00.000Z";
    const checkInByPlayer = new Map([
      ["adam", at],
      ["zoe", at],
    ]);
    const rows = computeLeaderboard(matches, { ...ALL, checkInByPlayer });
    const ranked = rows.filter((r) => r.playerId !== "foil").map((r) => r.playerId);
    expect(ranked).toEqual(["adam", "zoe"]);
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

describe("carry", () => {
  it("counts wins alongside a weaker partner, and the rungs carried", () => {
    const adv = player("adv", "ADVANCED");
    const cas = player("cas", "CASUAL");
    const opp = [player("o1", "INTERMEDIATE"), player("o2", "INTERMEDIATE")];
    const row = rowFor(
      [match([adv, cas], opp, "SIDE_A"), match([adv, cas], opp, "SIDE_A")],
      "adv"
    );
    expect(row.carryWins).toBe(2);
    expect(row.carryRungs).toBe(6); // 3 rungs each
  });

  it("gives the weaker partner no carry credit for the same win", () => {
    const adv = player("adv", "ADVANCED");
    const cas = player("cas", "CASUAL");
    const opp = [player("o1", "INTERMEDIATE"), player("o2", "INTERMEDIATE")];
    expect(rowFor([match([adv, cas], opp, "SIDE_A")], "cas").carryWins).toBe(0);
  });

  it("counts only wins, and only doubles", () => {
    const adv = player("adv", "ADVANCED");
    const cas = player("cas", "CASUAL");
    const opp = [player("o1", "ADVANCED"), player("o2", "ADVANCED")];
    expect(rowFor([match([adv, cas], opp, "SIDE_B")], "adv").carryWins).toBe(0);
    expect(
      rowFor([match([adv], [player("s", "CASUAL")], "SIDE_A")], "adv").carryWins
    ).toBe(0);
  });

  // Unlike the points bonus, this is not gated on being the underdog: beating a
  // weak pair while carrying a weak partner is still carrying.
  it("counts a carry even when the pair were favourites", () => {
    const adv = player("adv", "ADVANCED");
    const cas = player("cas", "CASUAL");
    const opp = [player("o1", "CASUAL"), player("o2", "CASUAL")];
    const row = rowFor([match([adv, cas], opp, "SIDE_A")], "adv");
    expect(row.carryWins).toBe(1);
    expect(row.bonusPoints).toBe(0); // but no points bonus, which IS gated
  });
});

describe("honors", () => {
  // The whole reason for the standout score: the old fixed list made a 1-rung
  // upset beat a 6-match streak purely because upset was written first.
  it("ranks a runaway streak above a commonplace upset", () => {
    const foil = player("foil");
    const streaky = player("streaky");
    // Six upsets of one rung each, spread so no single player stands clear.
    const upsetters = ["u1", "u2", "u3"].map((id) => player(id, "BEGINNER"));
    const stronger = player("strong", "INTERMEDIATE");
    const matches = [
      ...Array.from({ length: 6 }, () => match([streaky], [foil], "SIDE_A")),
      ...upsetters.flatMap((u) => [match([u], [stronger], "SIDE_A")]),
      ...Array.from({ length: 3 }, () => match([player("mid")], [foil], "SIDE_A")),
    ];
    const honors = selectHonors(computeLeaderboard(matches, ALL), 3);
    expect(honors[0].kind).toBe("streak");
    expect(honors[0].playerId).toBe("streaky");
  });

  it("ranks a lone big upset above a narrow lead in matches played", () => {
    const foil = player("foil");
    const casual = player("cas", "CASUAL");
    const advanced = player("adv", "ADVANCED");
    const matches = [
      match([casual], [advanced], "SIDE_A"),
      ...Array.from({ length: 5 }, () => match([player("busy")], [foil], "SIDE_A")),
      ...Array.from({ length: 4 }, () => match([player("busy2")], [foil], "SIDE_A")),
    ];
    const honors = selectHonors(computeLeaderboard(matches, ALL), 3);
    expect(honors[0].kind).toBe("upset");
  });

  it("awards an honor to a podium player who genuinely earned it", () => {
    const [champ, foil, other] = [player("champ"), player("foil"), player("other")];
    const matches = [
      ...Array.from({ length: 5 }, () => match([champ], [foil], "SIDE_A")),
      match([other], [foil], "SIDE_A"),
      match([other], [foil], "SIDE_B"),
    ];
    const rows = computeLeaderboard(matches, ALL);
    expect(rows[0].playerId).toBe("champ");
    const streak = selectHonors(rows, 3).find((h) => h.kind === "streak");
    expect(streak?.playerId).toBe("champ");
  });

  // Two adjacent cards on the same name looks like a rendering fault.
  it("gives one player at most one honor", () => {
    const [a, b, c, foil] = ["a", "b", "c", "foil"].map((id) => player(id));
    const matches = [
      ...Array.from({ length: 4 }, () => match([a], [foil], "SIDE_A")),
      ...Array.from({ length: 3 }, () => match([b], [foil], "SIDE_A")),
      match([c], [foil], "SIDE_A"),
    ];
    const honors = selectHonors(computeLeaderboard(matches, ALL), 3);
    expect(new Set(honors.map((h) => h.playerId)).size).toBe(honors.length);
  });

  it("never repeats an award kind", () => {
    const foil = player("foil");
    const matches = ["a", "b", "c", "d"].flatMap((id, i) =>
      Array.from({ length: 5 - i }, () => match([player(id)], [foil], "SIDE_A"))
    );
    const honors = selectHonors(computeLeaderboard(matches, ALL), 3);
    expect(new Set(honors.map((h) => h.kind)).size).toBe(honors.length);
  });

  // Adjacency-constrained matchups mean plenty of sessions produce no upset.
  it("skips awards nobody qualified for rather than rendering them empty", () => {
    const [a, b, foil] = [player("a"), player("b"), player("foil")];
    const matches = [
      ...Array.from({ length: 3 }, () => match([a], [foil], "SIDE_A")),
      ...Array.from({ length: 2 }, () => match([b], [foil], "SIDE_A")),
    ];
    const honors = selectHonors(computeLeaderboard(matches, ALL), 3);
    expect(honors.some((h) => h.kind === "upset")).toBe(false);
    expect(honors.some((h) => h.kind === "carry")).toBe(false);
    expect(honors.every((h) => h.detail.length > 0)).toBe(true);
  });

  it("returns fewer honors than slots rather than inventing them", () => {
    const [a, b] = [player("a"), player("b")];
    const honors = selectHonors(computeLeaderboard([match([a], [b], "SIDE_A")], ALL), 3);
    expect(honors.length).toBeLessThanOrEqual(3);
  });

  it("respects the slot count", () => {
    const foil = player("foil");
    const matches = ["a", "b", "c", "d", "e"].flatMap((id, i) =>
      Array.from({ length: 6 - i }, () => match([player(id)], [foil], "SIDE_A"))
    );
    expect(selectHonors(computeLeaderboard(matches, ALL), 2).length).toBe(2);
  });

  it("ignores a two-match streak, which is noise in a four-match evening", () => {
    const [a, b, foil] = [player("a"), player("b"), player("foil")];
    const matches = [
      match([a], [foil], "SIDE_A"),
      match([a], [foil], "SIDE_A"),
      match([a], [foil], "SIDE_B"),
      match([b], [foil], "SIDE_A"),
    ];
    const rows = computeLeaderboard(matches, ALL);
    expect(rows.find((r) => r.playerId === "a")!.longestStreak).toBe(2);
    expect(selectHonors(rows, 3).some((h) => h.kind === "streak")).toBe(false);
  });

  it("awards On Fire from three wins in a row", () => {
    const [a, foil] = [player("a"), player("foil")];
    const matches = Array.from({ length: 3 }, () => match([a], [foil], "SIDE_A"));
    const streak = selectHonors(computeLeaderboard(matches, ALL), 3).find(
      (h) => h.kind === "streak"
    );
    expect(streak?.label).toBe("On Fire");
    expect(streak?.detail).toBe("3 wins in a row");
  });

  it("surfaces The Carry when someone won repeatedly with weaker partners", () => {
    const adv = player("adv", "ADVANCED");
    const cas = player("cas", "CASUAL");
    const opp = [player("o1", "ADVANCED"), player("o2", "ADVANCED")];
    const matches = Array.from({ length: 3 }, () => match([adv, cas], opp, "SIDE_A"));
    const honors = selectHonors(computeLeaderboard(matches, ALL), 3);
    const carry = honors.find((h) => h.kind === "carry");
    expect(carry?.playerId).toBe("adv");
    expect(carry?.label).toBe("The Carry");
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

  it("stays silent about the upset when the honor card is already showing it", () => {
    const casual = player("casual", "CASUAL");
    const advanced = player("Tita", "ADVANCED");
    // A perfect record as well as an upset, so the line still has something to
    // say once the upset is suppressed — otherwise this would only prove that
    // an empty summary is empty.
    const rows = computeLeaderboard(
      Array.from({ length: 3 }, () => match([casual], [advanced], "SIDE_A")),
      ALL
    );
    const champion = rows.find((r) => r.playerId === "casual")!;
    expect(championSummary(champion)).toContain("Tita");
    const suppressed = championSummary(champion, { suppressUpset: true });
    expect(suppressed).toContain("Won all 3");
    expect(suppressed).not.toContain("Tita");
  });

  // "Won all 5" requires zero losses and zero draws, so the record and the
  // longest streak are the same number — identical to a card reading
  // "5 wins in a row" sitting directly beneath it.
  it("stays silent about the streak when the honor card is already showing it", () => {
    const [a, mate, o1, o2] = ["a", "mate", "o1", "o2"].map((id) => player(id));
    const rows = computeLeaderboard(
      Array.from({ length: 3 }, () => match([a, mate], [o1, o2], "SIDE_A")),
      ALL
    );
    const champion = rows.find((r) => r.playerId === "a")!;
    expect(championSummary(champion)).toContain("Won all 3");
    const suppressed = championSummary(champion, { suppressStreak: true });
    expect(suppressed).not.toContain("Won all");
    // Falls through to the partner fact rather than going blank.
    expect(suppressed).toContain("mate");
  });

  it("goes silent rather than inventing a fact when every angle is suppressed", () => {
    const [a, b] = [player("a"), player("b")];
    const rows = computeLeaderboard(
      Array.from({ length: 4 }, () => match([a], [b], "SIDE_A")),
      ALL
    );
    const champion = rows.find((r) => r.playerId === "a")!;
    expect(
      championSummary(champion, { suppressStreak: true, suppressUpset: true })
    ).toBeNull();
  });

  // An empty line reads better than "had a good session".
  it("returns null rather than filler when nothing specific happened", () => {
    const [a, b] = [player("a"), player("b")];
    const rows = computeLeaderboard([match([a], [b], "SIDE_A"), match([a], [b], "SIDE_B")], ALL);
    expect(championSummary(rows.find((r) => r.playerId === "a")!)).toBeNull();
  });
});
