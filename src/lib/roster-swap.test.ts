import { describe, it, expect } from "vitest";
import {
  resolveSwap,
  canDrop,
  type Endpoint,
  type RosterState,
  type SwapContext,
  type DropTargetKind,
} from "./roster-swap";
import type { BenchEntry, Court, PlanningCard, Player, QueueEntry } from "@/types";

// Deterministic so generated ids and timestamps don't leak into assertions.
let idCounter = 0;
const ctx: SwapContext = {
  now: "2026-01-01T12:00:00.000Z",
  newId: (prefix) => `${prefix}-t${++idCounter}`,
};

const P = (id: string, name: string): Player => ({
  id,
  name,
  skillLevel: "INTERMEDIATE",
  paymentStatus: "UNPAID",
});

const q = (player: Player, i: number): QueueEntry => ({
  id: `q-${player.id}`,
  position: i + 1,
  player,
  isInMatch: false,
  sessionJoinedAt: `2026-01-01T10:0${i}:00.000Z`,
  enteredQueueAt: "2026-01-01T11:00:00.000Z",
});

const b = (player: Player): BenchEntry => ({
  id: `b-${player.id}`,
  player,
  sessionJoinedAt: "2026-01-01T10:30:00.000Z",
});

const card = (
  id: string,
  sideA: (Player | null)[],
  sideB: (Player | null)[],
  matchType: "SINGLES" | "DOUBLES" = "DOUBLES"
): PlanningCard => {
  const max = matchType === "DOUBLES" ? 2 : 1;
  const has = [...sideA, ...sideB].some(Boolean);
  const full = sideA.slice(0, max).every(Boolean) && sideB.slice(0, max).every(Boolean);
  return {
    id,
    matchType,
    state: full ? "ready" : has ? "proposed" : "empty",
    suggestion: has ? { sideA, sideB, pairsExhausted: false } : null,
  };
};

const court = (id: string, number: number, sideA: Player[], sideB: Player[]): Court => ({
  id,
  number,
  status: "IN_USE",
  activeMatch: {
    id: `m-${id}`,
    courtId: id,
    courtName: `Court ${number}`,
    matchType: "DOUBLES",
    sideA,
    sideB,
    startedAt: "2026-01-01T11:30:00.000Z",
    sessionJoinedAtByPlayer: Object.fromEntries(
      [...sideA, ...sideB].map((p, i) => [p.id, `2026-01-01T09:0${i}:00.000Z`])
    ),
  },
});

const A = P("a", "Alice");
const B = P("b", "Bob");
const C = P("c", "Carol");
const D = P("d", "Dave");
const I = P("i", "Ivy");
const J = P("j", "Jon");
const K = P("k", "Kim");
const M = P("m", "Mia");

/** Every player id present anywhere — a swap exchanges positions, never adds or drops anyone. */
function population(state: RosterState): Set<string> {
  const ids = new Set<string>();
  for (const e of state.queue) ids.add(e.player.id);
  for (const e of state.bench) ids.add(e.player.id);
  for (const c of state.courts) {
    if (!c.activeMatch) continue;
    for (const p of [...c.activeMatch.sideA, ...c.activeMatch.sideB]) ids.add(p.id);
  }
  return ids;
}

/** Structural rules that must hold after any successful swap. */
function expectInvariants(next: RosterState, before: RosterState) {
  expect(Array.from(population(next)).sort()).toEqual(Array.from(population(before)).sort());

  for (const id of Array.from(population(next))) {
    const inQueue = next.queue.filter((e) => e.player.id === id).length;
    const inBench = next.bench.filter((e) => e.player.id === id).length;
    const onCourt = next.courts.filter(
      (c) =>
        c.activeMatch && [...c.activeMatch.sideA, ...c.activeMatch.sideB].some((p) => p.id === id)
    ).length;
    expect(`${id}:${inQueue + inBench + onCourt}`).toBe(`${id}:1`);
  }

  for (const c of next.courts) {
    if (!c.activeMatch) continue;
    expect(c.activeMatch.sideA.every(Boolean) && c.activeMatch.sideB.every(Boolean)).toBe(true);
  }

  // Every card occupant must still have a queue entry behind it.
  for (const c of next.cards) {
    if (!c.suggestion) continue;
    for (const p of [...c.suggestion.sideA, ...c.suggestion.sideB]) {
      if (!p) continue;
      expect(next.queue.some((e) => e.player.id === p.id)).toBe(true);
    }
  }

  // Queue positions stay 1-indexed and contiguous.
  next.queue.forEach((e, i) => expect(e.position).toBe(i + 1));
}

function ok(result: ReturnType<typeof resolveSwap>) {
  if (!result.ok) throw new Error(`expected success, got rejection: ${result.message ?? "(silent)"}`);
  return result;
}

// ── Existing behaviors: these predate the court-swap work and must not drift ──

describe("planning card ↔ planning card", () => {
  const base = (): RosterState => ({
    queue: [q(I, 0), q(J, 1)],
    bench: [],
    cards: [card("c1", [I, null], [null, null]), card("c2", [J, null], [null, null])],
    courts: [],
  });

  it("relocates into an empty slot on another card", () => {
    const s: RosterState = {
      ...base(),
      cards: [card("c1", [I, null], [null, null]), card("c2", [null, null], [null, null])],
    };
    const r = ok(resolveSwap(s, { kind: "card", cardId: "c1", side: "A", index: 0 }, { kind: "card", cardId: "c2", side: "B", index: 1 }, ctx));
    expect(r.next.cards[0].suggestion).toBeNull();
    expect(r.next.cards[0].state).toBe("empty");
    expect(r.next.cards[1].suggestion?.sideB[1]?.id).toBe("i");
  });

  it("swaps two occupied slots across cards", () => {
    const s = base();
    const r = ok(resolveSwap(s, { kind: "card", cardId: "c1", side: "A", index: 0 }, { kind: "card", cardId: "c2", side: "A", index: 0 }, ctx));
    expect(r.next.cards[0].suggestion?.sideA[0]?.id).toBe("j");
    expect(r.next.cards[1].suggestion?.sideA[0]?.id).toBe("i");
  });

  it("swaps two slots within one card (both writes land)", () => {
    const s: RosterState = { ...base(), cards: [card("c1", [I, null], [J, null])] };
    const r = ok(resolveSwap(s, { kind: "card", cardId: "c1", side: "A", index: 0 }, { kind: "card", cardId: "c1", side: "B", index: 0 }, ctx));
    expect(r.next.cards[0].suggestion?.sideA[0]?.id).toBe("j");
    expect(r.next.cards[0].suggestion?.sideB[0]?.id).toBe("i");
  });
});

describe("queue / bench → planning card", () => {
  it("places into an empty slot and keeps the queue entry", () => {
    const s: RosterState = { queue: [q(I, 0)], bench: [], cards: [card("c1", [null, null], [null, null])], courts: [] };
    const r = ok(resolveSwap(s, { kind: "queue", playerId: "i" }, { kind: "card", cardId: "c1", side: "A", index: 0 }, ctx));
    expect(r.next.cards[0].suggestion?.sideA[0]?.id).toBe("i");
    // Placement is not court assignment — the queue entry stays.
    expect(r.next.queue.some((e) => e.player.id === "i")).toBe(true);
    expect(r.message).toBeNull();
  });

  it("promotes a bench player into the queue on placement", () => {
    const s: RosterState = { queue: [], bench: [b(I)], cards: [card("c1", [null, null], [null, null])], courts: [] };
    const r = ok(resolveSwap(s, { kind: "bench", playerId: "i" }, { kind: "card", cardId: "c1", side: "A", index: 0 }, ctx));
    expect(r.next.bench).toHaveLength(0);
    expect(r.next.queue[0].player.id).toBe("i");
    expect(r.next.queue[0].sessionJoinedAt).toBe("2026-01-01T10:30:00.000Z");
  });

  it("replaces the occupant of a filled slot, leaving them in the queue", () => {
    const s: RosterState = { queue: [q(I, 0), q(J, 1)], bench: [], cards: [card("c1", [J, null], [null, null])], courts: [] };
    const r = ok(resolveSwap(s, { kind: "queue", playerId: "i" }, { kind: "card", cardId: "c1", side: "A", index: 0 }, ctx));
    expect(r.next.cards[0].suggestion?.sideA[0]?.id).toBe("i");
    expect(r.next.queue.some((e) => e.player.id === "j")).toBe(true);
    expect(r.next.queue).toHaveLength(2);
    expect(r.message).toBe("Ivy replaced Jon in the matchup");
    expect(r.undoLabel).toBe("Undo replace");
    expectInvariants(r.next, s);
  });

  it("refuses to card the same player twice", () => {
    const s: RosterState = {
      queue: [q(I, 0), q(J, 1)],
      bench: [],
      cards: [card("c1", [J, null], [null, null]), card("c2", [I, null], [null, null])],
      courts: [],
    };
    const r = resolveSwap(s, { kind: "queue", playerId: "i" }, { kind: "card", cardId: "c1", side: "A", index: 0 }, ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Ivy is already in a card");
  });

  it("ignores a slot index beyond a singles card's one slot", () => {
    const s: RosterState = { queue: [q(I, 0)], bench: [], cards: [card("c1", [null], [null], "SINGLES")], courts: [] };
    expect(resolveSwap(s, { kind: "queue", playerId: "i" }, { kind: "card", cardId: "c1", side: "A", index: 1 }, ctx).ok).toBe(false);
  });
});

describe("substituting into a live court", () => {
  const live = (): RosterState => ({ queue: [q(I, 0)], bench: [], cards: [], courts: [court("ct1", 1, [A, B], [C, D])] });

  it("sends the outgoing player to the bench, not the queue", () => {
    const s = live();
    const r = ok(resolveSwap(s, { kind: "queue", playerId: "i" }, { kind: "court", courtId: "ct1", side: "A", index: 0 }, ctx));
    expect(r.next.courts[0].activeMatch!.sideA[0].id).toBe("i");
    expect(r.next.bench.some((e) => e.player.id === "a")).toBe(true);
    expect(r.next.queue.some((e) => e.player.id === "i")).toBe(false);
    expect(r.message).toBe("Ivy subbed in for Alice");
    expectInvariants(r.next, s);
  });

  it("leaves the match's identity and clock untouched", () => {
    const s = live();
    const r = ok(resolveSwap(s, { kind: "queue", playerId: "i" }, { kind: "court", courtId: "ct1", side: "A", index: 0 }, ctx));
    expect(r.next.courts[0].activeMatch!.startedAt).toBe("2026-01-01T11:30:00.000Z");
    expect(r.next.courts[0].activeMatch!.id).toBe("m-ct1");
  });

  it("clears the source card slot when subbing from a chip", () => {
    const s: RosterState = { queue: [q(I, 0)], bench: [], cards: [card("c1", [I, null], [null, null])], courts: [court("ct1", 1, [A, B], [C, D])] };
    const r = ok(resolveSwap(s, { kind: "card", cardId: "c1", side: "A", index: 0 }, { kind: "court", courtId: "ct1", side: "B", index: 1 }, ctx));
    expect(r.next.courts[0].activeMatch!.sideB[1].id).toBe("i");
    expect(r.next.cards[0].suggestion).toBeNull();
    expect(r.next.bench.some((e) => e.player.id === "d")).toBe(true);
    expectInvariants(r.next, s);
  });

  it("refuses a queue player who is already carded (would double-book them)", () => {
    const s: RosterState = { queue: [q(I, 0)], bench: [], cards: [card("c1", [I, null], [null, null])], courts: [court("ct1", 1, [A, B], [C, D])] };
    const r = resolveSwap(s, { kind: "queue", playerId: "i" }, { kind: "court", courtId: "ct1", side: "A", index: 0 }, ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Ivy is already in a matchup card");
  });

  it("refuses someone already in that match", () => {
    const s: RosterState = { queue: [q(A, 0)], bench: [], cards: [], courts: [court("ct1", 1, [A, B], [C, D])] };
    const r = resolveSwap(s, { kind: "queue", playerId: "a" }, { kind: "court", courtId: "ct1", side: "B", index: 0 }, ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Alice is already in this match");
  });
});

// ── Court as a swap source ───────────────────────────────────────────────────

describe("court player as the swap source", () => {
  it("reorders two players on the same court", () => {
    const s: RosterState = { queue: [], bench: [], cards: [], courts: [court("ct1", 1, [A, B], [C, D])] };
    const r = ok(resolveSwap(s, { kind: "court", courtId: "ct1", side: "A", index: 0 }, { kind: "court", courtId: "ct1", side: "B", index: 0 }, ctx));
    expect(r.next.courts[0].activeMatch!.sideB[0].id).toBe("a");
    expect(r.next.courts[0].activeMatch!.sideA[0].id).toBe("c");
    expect(r.message).toBe("Swapped Alice and Carol on Court 1");
    expectInvariants(r.next, s);
  });

  it("trades players between two live courts, carrying check-in times", () => {
    const s: RosterState = {
      queue: [], bench: [], cards: [],
      courts: [court("ct1", 1, [A, B], [C, D]), court("ct2", 2, [I, J], [K, M])],
    };
    const r = ok(resolveSwap(s, { kind: "court", courtId: "ct1", side: "A", index: 0 }, { kind: "court", courtId: "ct2", side: "A", index: 1 }, ctx));
    expect(r.next.courts[1].activeMatch!.sideA[1].id).toBe("a");
    expect(r.next.courts[0].activeMatch!.sideA[0].id).toBe("j");
    expect(r.next.courts[1].activeMatch!.sessionJoinedAtByPlayer["a"]).toBe("2026-01-01T09:00:00.000Z");
    expect(r.message).toBe("Swapped Alice (Court 1) and Jon (Court 2)");
    expectInvariants(r.next, s);
  });

  it("inherits both the card slot and the queue entry when swapping with a chip", () => {
    const s: RosterState = {
      queue: [q(I, 0), q(J, 1)], bench: [],
      cards: [card("c1", [I, null], [null, null])],
      courts: [court("ct1", 1, [A, B], [C, D])],
    };
    const r = ok(resolveSwap(s, { kind: "court", courtId: "ct1", side: "A", index: 0 }, { kind: "card", cardId: "c1", side: "A", index: 0 }, ctx));
    expect(r.next.courts[0].activeMatch!.sideA[0].id).toBe("i");
    expect(r.next.cards[0].suggestion?.sideA[0]?.id).toBe("a");
    expect(r.next.queue[0].player.id).toBe("a");
    expect(r.next.queue[0].sessionJoinedAt).toBe("2026-01-01T09:00:00.000Z");
    expect(r.message).toBe("Ivy subbed into Court 1, Alice moved to a matchup card");
    expectInvariants(r.next, s);
  });

  it("takes over the exact queue position it was dropped on", () => {
    const s: RosterState = { queue: [q(I, 0), q(J, 1)], bench: [], cards: [], courts: [court("ct1", 1, [A, B], [C, D])] };
    const r = ok(resolveSwap(s, { kind: "court", courtId: "ct1", side: "B", index: 1 }, { kind: "queue", playerId: "j" }, ctx));
    expect(r.next.courts[0].activeMatch!.sideB[1].id).toBe("j");
    expect(r.next.queue[1].player.id).toBe("d");
    expect(r.message).toBe("Jon subbed into Court 1, Dave moved to the queue");
    expectInvariants(r.next, s);
  });

  it("takes over a bench spot", () => {
    const s: RosterState = { queue: [], bench: [b(I)], cards: [], courts: [court("ct1", 1, [A, B], [C, D])] };
    const r = ok(resolveSwap(s, { kind: "court", courtId: "ct1", side: "A", index: 1 }, { kind: "bench", playerId: "i" }, ctx));
    expect(r.next.courts[0].activeMatch!.sideA[1].id).toBe("i");
    expect(r.next.bench).toHaveLength(1);
    expect(r.next.bench[0].player.id).toBe("b");
    expectInvariants(r.next, s);
  });

  it("refuses an empty card slot rather than leaving a match short", () => {
    const s: RosterState = { queue: [], bench: [], cards: [card("c1", [null, null], [null, null])], courts: [court("ct1", 1, [A, B], [C, D])] };
    const r = resolveSwap(s, { kind: "court", courtId: "ct1", side: "A", index: 0 }, { kind: "card", cardId: "c1", side: "A", index: 0 }, ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("A live match can't be left short — swap with a player instead.");
  });

  it("refuses a queue row whose player is already carded", () => {
    const s: RosterState = { queue: [q(I, 0)], bench: [], cards: [card("c1", [I, null], [null, null])], courts: [court("ct1", 1, [A, B], [C, D])] };
    const r = resolveSwap(s, { kind: "court", courtId: "ct1", side: "A", index: 0 }, { kind: "queue", playerId: "i" }, ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Ivy is already in a matchup card");
  });
});

describe("general guarantees", () => {
  const s = (): RosterState => ({ queue: [], bench: [], cards: [], courts: [court("ct1", 1, [A, B], [C, D])] });

  it("treats a move onto itself as a silent no-op", () => {
    const r = resolveSwap(s(), { kind: "court", courtId: "ct1", side: "A", index: 0 }, { kind: "court", courtId: "ct1", side: "A", index: 0 }, ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toBeNull();
  });

  it("never mutates the state it was given", () => {
    const before = s();
    const snapshot = JSON.stringify(before);
    resolveSwap(before, { kind: "court", courtId: "ct1", side: "A", index: 0 }, { kind: "court", courtId: "ct1", side: "B", index: 0 }, ctx);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

// ── The anti-drift guard for the bug class that actually shipped ─────────────

describe("canDrop agrees with resolveSwap", () => {
  const ORIGINS: Endpoint["kind"][] = ["queue", "bench", "card", "court"];
  const TARGETS: DropTargetKind[] = ["card-empty", "card-filled", "court", "pool"];

  // One world carrying a populated example of every position kind.
  const world = (): RosterState => ({
    queue: [q(I, 0), q(K, 1)],
    bench: [b(M)],
    cards: [card("c1", [J, null], [null, null])],
    courts: [court("ct1", 1, [A, B], [C, D])],
  });
  // J sits in both the queue and card c1, so a card origin is reachable.
  const worldWithCardedQueue = (): RosterState => {
    const w = world();
    return { ...w, queue: [q(I, 0), q(K, 1), q(J, 2)] };
  };

  const originEndpoint: Record<Endpoint["kind"], Endpoint> = {
    queue: { kind: "queue", playerId: "i" },
    bench: { kind: "bench", playerId: "m" },
    card: { kind: "card", cardId: "c1", side: "A", index: 0 },
    court: { kind: "court", courtId: "ct1", side: "A", index: 0 },
  };
  const targetEndpoint: Record<DropTargetKind, Endpoint> = {
    "card-empty": { kind: "card", cardId: "c1", side: "B", index: 0 },
    "card-filled": { kind: "card", cardId: "c1", side: "A", index: 0 },
    court: { kind: "court", courtId: "ct1", side: "B", index: 0 },
    pool: { kind: "queue", playerId: "k" },
  };

  for (const origin of ORIGINS) {
    for (const target of TARGETS) {
      const allowed = canDrop(origin, target);
      it(`${origin} → ${target}: ${allowed ? "accepted, so never silent" : "refused"}`, () => {
        if (!allowed) return; // refusal is enforced by the UI never highlighting
        const from = originEndpoint[origin];
        const to = targetEndpoint[target];
        if (JSON.stringify(from) === JSON.stringify(to)) return;
        const r = resolveSwap(worldWithCardedQueue(), from, to, ctx);
        // The contract: an accepted drop either succeeds, or explains itself.
        // Silently swallowing it is the bug that shipped three times.
        const silentlySwallowed = !r.ok && r.message === null;
        expect(silentlySwallowed).toBe(false);
      });
    }
  }
});
