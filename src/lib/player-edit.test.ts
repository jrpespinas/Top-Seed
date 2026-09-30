import { describe, it, expect } from "vitest";
import {
  patchEntries,
  patchCards,
  patchCourts,
  renameInMatches,
  locatePlayer,
  playerOf,
} from "./player-edit";
import type { BenchEntry, Court, MatchRecord, PlanningCard, Player, QueueEntry } from "@/types";

const player = (id: string, name = id): Player => ({
  id,
  name,
  skillLevel: "INTERMEDIATE",
  paymentStatus: "UNPAID",
});

const queueEntry = (p: Player, isInMatch = false): QueueEntry => ({
  id: `q-${p.id}`,
  position: 1,
  player: p,
  isInMatch,
  sessionJoinedAt: "2026-09-30T18:00:00.000Z",
  enteredQueueAt: "2026-09-30T18:00:00.000Z",
});

const benchEntry = (p: Player): BenchEntry => ({
  id: `b-${p.id}`,
  player: p,
  sessionJoinedAt: "2026-09-30T18:00:00.000Z",
});

const card = (id: string, sideA: (Player | null)[], sideB: (Player | null)[]): PlanningCard => ({
  id,
  matchType: "DOUBLES",
  state: "proposed",
  suggestion: { sideA, sideB, pairsExhausted: false },
});

const court = (id: string, sideA: Player[], sideB: Player[]): Court => ({
  id,
  number: 1,
  status: "IN_USE",
  activeMatch: {
    id: `m-${id}`,
    courtId: id,
    courtName: "Court 1",
    matchType: "DOUBLES",
    sideA,
    sideB,
    startedAt: "2026-09-30T18:10:00.000Z",
    sessionJoinedAtByPlayer: {},
  },
});

const record = (id: string, sideA: Player[], sideB: Player[]): MatchRecord => ({
  id,
  sessionId: "s1",
  courtName: "Court 1",
  matchType: "DOUBLES",
  sideA,
  sideB,
  result: "SIDE_A",
  status: "COMPLETED",
  startedAt: "2026-09-30T18:00:00.000Z",
  endedAt: "2026-09-30T18:20:00.000Z",
});

describe("patchEntries", () => {
  it("updates only the matching player", () => {
    const entries = [queueEntry(player("a")), queueEntry(player("b"))];
    const next = patchEntries(entries, "a", { name: "Ada", skillLevel: "ADVANCED" });
    expect(next[0].player).toMatchObject({ name: "Ada", skillLevel: "ADVANCED" });
    expect(next[1]).toBe(entries[1]);
  });

  it("keeps fields the edit didn't touch, like payment", () => {
    const entries = [queueEntry({ ...player("a"), paymentStatus: "PAID" })];
    expect(patchEntries(entries, "a", { name: "Ada" })[0].player.paymentStatus).toBe("PAID");
  });

  // A no-op edit must not hand React fresh arrays and re-render the dashboard.
  it("returns the same array when the player isn't there", () => {
    const entries = [queueEntry(player("a"))];
    expect(patchEntries(entries, "zzz", { name: "X" })).toBe(entries);
  });
});

// The bug this module exists for: editing only the queue entry left a card
// still showing the old name, and the card carried it onto the court.
describe("patchCards", () => {
  it("renames the player's copy inside a matchup card", () => {
    const cards = [card("c1", [player("a", "Bgos"), null], [player("b"), null])];
    const next = patchCards(cards, "a", { name: "Bogs" });
    expect(next[0].suggestion!.sideA[0]!.name).toBe("Bogs");
    expect(next[0].suggestion!.sideA[1]).toBeNull();
  });

  it("leaves untouched cards and empty cards alone", () => {
    const untouched = card("c1", [player("x")], [player("y")]);
    const empty: PlanningCard = { id: "c2", matchType: "SINGLES", state: "empty", suggestion: null };
    const cards = [untouched, empty];
    expect(patchCards(cards, "a", { name: "Z" })).toBe(cards);
  });
});

describe("patchCourts", () => {
  it("updates the live match copy of a player on court", () => {
    const courts = [court("k1", [player("a", "Bgos")], [player("b")])];
    const next = patchCourts(courts, "a", { name: "Bogs", skillLevel: "ADVANCED" });
    expect(next[0].activeMatch!.sideA[0]).toMatchObject({ name: "Bogs", skillLevel: "ADVANCED" });
  });

  it("ignores empty courts", () => {
    const courts: Court[] = [{ id: "k1", number: 1, status: "AVAILABLE" }];
    expect(patchCourts(courts, "a", { name: "Z" })).toBe(courts);
  });
});

describe("renameInMatches", () => {
  it("corrects the name on every finished match the player appears in", () => {
    const matches = [
      record("m1", [player("a", "Bgos")], [player("b")]),
      record("m2", [player("c")], [player("a", "Bgos")]),
      record("m3", [player("c")], [player("d")]),
    ];
    const next = renameInMatches(matches, "a", "Bogs");
    expect(next[0].sideA[0].name).toBe("Bogs");
    expect(next[1].sideB[0].name).toBe("Bogs");
    expect(next[2]).toBe(matches[2]);
  });

  // Skill level stays as recorded: upset bonuses were earned against the
  // level a player had at the time.
  it("never rewrites the recorded skill level", () => {
    const matches = [record("m1", [{ ...player("a"), skillLevel: "BEGINNER" }], [player("b")])];
    const next = renameInMatches(matches, "a", "Bogs");
    expect(next[0].sideA[0].skillLevel).toBe("BEGINNER");
  });

  it("returns the same array when nothing needs renaming", () => {
    const matches = [record("m1", [player("a", "Bogs")], [player("b")])];
    expect(renameInMatches(matches, "a", "Bogs")).toBe(matches);
  });
});

describe("locatePlayer", () => {
  it("finds a queued player, preferring the queue entry over a card copy", () => {
    const a = player("a");
    const loc = locatePlayer("a", [queueEntry(a)], [], [], [card("c1", [a], [null])]);
    expect(loc?.where).toBe("queue");
  });

  it("finds a benched player", () => {
    expect(locatePlayer("a", [], [benchEntry(player("a"))], [], [])?.where).toBe("bench");
  });

  it("finds a player on court even if a stale in-match queue entry exists", () => {
    const a = player("a");
    const loc = locatePlayer("a", [queueEntry(a, true)], [], [court("k1", [a], [player("b")])], []);
    expect(loc?.where).toBe("court");
  });

  it("returns null for someone no longer in the session", () => {
    expect(locatePlayer("ghost", [], [], [], [])).toBeNull();
  });

  it("exposes the player object whichever place they were found", () => {
    const a = player("a", "Ada");
    const loc = locatePlayer("a", [], [], [court("k1", [a], [player("b")])], []);
    expect(playerOf(loc!).name).toBe("Ada");
  });
});
