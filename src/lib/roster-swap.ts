import type { BenchEntry, Court, PlanningCard, Player, QueueEntry, Side } from "@/types";

/**
 * Every position a player can occupy on the Dashboard, as one addressable value.
 *
 * Before this existed the Dashboard carried two parallel selection states (a
 * queue `Player`, a planning-card `SlotAddress`) and a separate handler for each
 * source→target pair. Making live court rows a swap *source* too would have
 * turned that into roughly eight near-duplicate handlers, each re-deriving the
 * same queue-entry bookkeeping — which is exactly the logic that rots when it's
 * duplicated. One address type plus one resolver keeps it in a single place,
 * and being pure, it's testable without a browser (this project has neither a
 * test runner nor a headless browser, so "pure and callable from Node" is the
 * only verification path that actually exists).
 */
export type Endpoint =
  | { kind: "queue"; playerId: string }
  | { kind: "bench"; playerId: string }
  | { kind: "card"; cardId: string; side: Side; index: number }
  | { kind: "court"; courtId: string; side: Side; index: number };

/**
 * Two orthogonal facts govern every rule below:
 *
 * 1. **Pool membership** — a player is in the queue, on the bench, or on a
 *    court. Exactly one, never zero, never two.
 * 2. **Card placement** — a planning-card slot *references* a player who is
 *    also in the queue. Placement never removes the queue entry; only court
 *    assignment does. So a court player is never in a card, and a card
 *    occupant always has a queue entry behind it.
 */
export interface RosterState {
  queue: QueueEntry[];
  bench: BenchEntry[];
  cards: PlanningCard[];
  courts: Court[];
}

export type SwapResult =
  | { ok: true; next: RosterState; message: string | null; undoLabel: string | null }
  // `message: null` is a deliberate silent no-op (tapping a slot onto itself),
  // distinct from a rejection the organizer needs explained.
  | { ok: false; message: string | null };

/**
 * The four distinct things a drag can be dropped onto. Not the same as
 * `Endpoint["kind"]`: a planning-card slot behaves as two different targets
 * depending on whether it's occupied.
 */
export type DropTargetKind = "card-empty" | "card-filled" | "court" | "pool";

/**
 * Whether a drag starting from `origin` may be dropped onto `target`.
 *
 * This lived as inline conditionals across three components and drifted into
 * three separate bugs — a target that lit up and then silently swallowed the
 * drop, and two that refused drops they should have taken. It's a pure lookup
 * so the rules are testable and stated once.
 *
 * The contract that matters: **if this returns true, `resolveSwap` must never
 * silently do nothing.** It may still refuse for a state-dependent reason (the
 * player is already carded, say) as long as it explains itself. A target that
 * highlights and then swallows the drop is the bug class this prevents.
 */
export function canDrop(origin: Endpoint["kind"], target: DropTargetKind): boolean {
  switch (target) {
    // Anyone from the pool or another card can fill an empty slot. A live-court
    // player cannot: they may only ever trade places, never leave a match short.
    case "card-empty":
      return origin !== "court";
    // An occupied slot takes everyone — pool players replace the occupant,
    // chips relocate/swap, court players swap.
    case "card-filled":
      return true;
    // Court rows take every origin: three substitution sources plus court-to-
    // court swaps.
    case "court":
      return true;
    // The pool is not manually reorderable, so it only accepts the one drag
    // that means something here: a court player coming off a match.
    case "pool":
      return origin === "court";
  }
}

export interface SwapContext {
  now: string;
  newId: (prefix: string) => string;
}

export function defaultContext(): SwapContext {
  return {
    now: new Date().toISOString(),
    newId: (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

// A live match is the one place a hole is unrepresentable: End Match reads
// sideA/sideB to credit gamesPlayed and to label the "who won" buttons, and
// every one of those assumes a full roster.
const REJECT_COURT_TO_EMPTY = "A live match can't be left short — swap with a player instead.";

function cardMax(card: PlanningCard): number {
  return card.matchType === "DOUBLES" ? 2 : 1;
}

function courtLabel(court: Court): string {
  return `Court ${court.number}`;
}

export function playerAt(state: RosterState, ep: Endpoint): Player | null {
  switch (ep.kind) {
    case "queue":
      return state.queue.find((e) => e.player.id === ep.playerId)?.player ?? null;
    case "bench":
      return state.bench.find((e) => e.player.id === ep.playerId)?.player ?? null;
    case "card": {
      const card = state.cards.find((c) => c.id === ep.cardId);
      if (!card?.suggestion || ep.index >= cardMax(card)) return null;
      const side = ep.side === "A" ? card.suggestion.sideA : card.suggestion.sideB;
      return side[ep.index] ?? null;
    }
    case "court": {
      const court = state.courts.find((c) => c.id === ep.courtId);
      if (!court?.activeMatch) return null;
      const side = ep.side === "A" ? court.activeMatch.sideA : court.activeMatch.sideB;
      return side[ep.index] ?? null;
    }
  }
}

export function sameEndpoint(a: Endpoint, b: Endpoint): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "queue" || a.kind === "bench") return a.playerId === (b as typeof a).playerId;
  if (a.kind === "card" && b.kind === "card")
    return a.cardId === b.cardId && a.side === b.side && a.index === b.index;
  if (a.kind === "court" && b.kind === "court")
    return a.courtId === b.courtId && a.side === b.side && a.index === b.index;
  return false;
}

// The check-in timestamp travels with the player, not the seat — it drives FIFO
// re-entry order for the rest of the session, so it has to survive every hop
// between queue, bench, and court.
function sessionJoinedAtOf(state: RosterState, playerId: string, fallback: string): string {
  const q = state.queue.find((e) => e.player.id === playerId);
  if (q) return q.sessionJoinedAt;
  const b = state.bench.find((e) => e.player.id === playerId);
  if (b) return b.sessionJoinedAt;
  for (const court of state.courts) {
    const stamped = court.activeMatch?.sessionJoinedAtByPlayer[playerId];
    if (stamped) return stamped;
  }
  return fallback;
}

function isInAnyCard(cards: PlanningCard[], playerId: string): boolean {
  return cards.some(
    (c) => c.suggestion && [...c.suggestion.sideA, ...c.suggestion.sideB].some((p) => p?.id === playerId)
  );
}

interface CardWrite {
  cardId: string;
  side: Side;
  index: number;
  player: Player | null;
}

// Applied as a batch rather than one call per write: a same-card swap issues two
// writes to one card, and applying them sequentially against re-derived arrays
// would let the second clobber the first.
function applyCardWrites(cards: PlanningCard[], writes: CardWrite[]): PlanningCard[] {
  if (writes.length === 0) return cards;
  const byCard = new Map<string, CardWrite[]>();
  for (const w of writes) {
    const list = byCard.get(w.cardId);
    if (list) list.push(w);
    else byCard.set(w.cardId, [w]);
  }
  return cards.map((card) => {
    const cardWrites = byCard.get(card.id);
    if (!cardWrites) return card;
    const max = cardMax(card);
    const sideA: (Player | null)[] = card.suggestion
      ? [...card.suggestion.sideA]
      : Array(max).fill(null);
    const sideB: (Player | null)[] = card.suggestion
      ? [...card.suggestion.sideB]
      : Array(max).fill(null);
    for (const w of cardWrites) {
      if (w.index < 0 || w.index >= max) continue;
      if (w.side === "A") sideA[w.index] = w.player;
      else sideB[w.index] = w.player;
    }
    const hasAny = [...sideA, ...sideB].some(Boolean);
    const isFull = sideA.slice(0, max).every(Boolean) && sideB.slice(0, max).every(Boolean);
    return {
      ...card,
      state: isFull ? ("ready" as const) : hasAny ? ("proposed" as const) : ("empty" as const),
      suggestion: hasAny
        ? { pairsExhausted: card.suggestion?.pairsExhausted ?? false, sideA, sideB }
        : null,
    };
  });
}

interface CourtWrite {
  courtId: string;
  side: Side;
  index: number;
  player: Player;
  sessionJoinedAt: string;
}

function applyCourtWrites(courts: Court[], writes: CourtWrite[]): Court[] {
  if (writes.length === 0) return courts;
  const byCourt = new Map<string, CourtWrite[]>();
  for (const w of writes) {
    const list = byCourt.get(w.courtId);
    if (list) list.push(w);
    else byCourt.set(w.courtId, [w]);
  }
  return courts.map((court) => {
    const courtWrites = byCourt.get(court.id);
    if (!courtWrites || !court.activeMatch) return court;
    const sideA = [...court.activeMatch.sideA];
    const sideB = [...court.activeMatch.sideB];
    const joined = { ...court.activeMatch.sessionJoinedAtByPlayer };
    for (const w of courtWrites) {
      if (w.side === "A") sideA[w.index] = w.player;
      else sideB[w.index] = w.player;
      joined[w.player.id] = w.sessionJoinedAt;
    }
    // The match's own identity (id, startedAt, elapsed clock) is deliberately
    // untouched — a roster edit is not a new match.
    return {
      ...court,
      activeMatch: { ...court.activeMatch, sideA, sideB, sessionJoinedAtByPlayer: joined },
    };
  });
}

function removeFromQueue(queue: QueueEntry[], playerId: string): QueueEntry[] {
  return queue.filter((e) => e.player.id !== playerId).map((e, i) => ({ ...e, position: i + 1 }));
}

function makeQueueEntry(player: Player, sessionJoinedAt: string, ctx: SwapContext): QueueEntry {
  return {
    id: ctx.newId("q"),
    player,
    position: 0,
    isInMatch: false,
    sessionJoinedAt,
    enteredQueueAt: ctx.now,
  };
}

// Honors the drop target: the incoming player takes over the exact array index
// the outgoing player vacated, rather than being appended by check-in order.
// Dropping onto a specific row is the organizer naming a position.
function replaceQueueEntryAt(
  queue: QueueEntry[],
  index: number,
  entry: QueueEntry
): QueueEntry[] {
  const next = [...queue];
  next[index] = entry;
  return next.map((e, i) => ({ ...e, position: i + 1 }));
}

/**
 * Resolves one player-to-player move between any two positions.
 *
 * Court rows are the only source that can never *relocate*, only swap: they may
 * land on an occupied position or nothing at all. Every other source keeps its
 * existing ability to fill an empty card slot.
 */
export function resolveSwap(
  state: RosterState,
  from: Endpoint,
  to: Endpoint,
  ctx: SwapContext = defaultContext()
): SwapResult {
  if (sameEndpoint(from, to)) return { ok: false, message: null };

  const mover = playerAt(state, from);
  if (!mover) return { ok: false, message: null };
  const displaced = playerAt(state, to);
  if (displaced && displaced.id === mover.id) return { ok: false, message: null };

  if (from.kind === "card") {
    if (to.kind === "card") return cardToCard(state, from, to, mover, displaced);
    if (to.kind === "court") return intoCourt(state, from, to, mover, displaced, ctx);
    return { ok: false, message: null };
  }

  if (from.kind === "queue" || from.kind === "bench") {
    if (to.kind === "card") return poolToCard(state, from, to, mover, displaced, ctx);
    if (to.kind === "court") return intoCourt(state, from, to, mover, displaced, ctx);
    return { ok: false, message: null };
  }

  return fromCourt(state, from, to, mover, displaced, ctx);
}

// ── card → card ─────────────────────────────────────────────────────────────
// Pure slot shuffle. Neither player changes pool, so no queue/bench/court state
// moves at all — an empty target relocates, an occupied one swaps.
function cardToCard(
  state: RosterState,
  from: Extract<Endpoint, { kind: "card" }>,
  to: Extract<Endpoint, { kind: "card" }>,
  mover: Player,
  displaced: Player | null
): SwapResult {
  const toCard = state.cards.find((c) => c.id === to.cardId);
  if (!toCard || to.index >= cardMax(toCard)) return { ok: false, message: null };
  const cards = applyCardWrites(state.cards, [
    { cardId: from.cardId, side: from.side, index: from.index, player: displaced },
    { cardId: to.cardId, side: to.side, index: to.index, player: mover },
  ]);
  return { ok: true, next: { ...state, cards }, message: null, undoLabel: null };
}

// ── queue | bench → card slot ───────────────────────────────────────────────
// An empty slot is a plain placement. An occupied one is a *replace*, not a
// swap: the displaced player is already a queue member (that's the invariant
// behind every card occupant), so losing the slot just leaves them where they
// already were. Nothing needs to move for them — which is exactly why this
// reads as one action rather than an exchange.
// A bench player is promoted into the queue on placement, preserving the
// invariant that every card occupant has a queue entry behind it.
function poolToCard(
  state: RosterState,
  from: Extract<Endpoint, { kind: "queue" | "bench" }>,
  to: Extract<Endpoint, { kind: "card" }>,
  mover: Player,
  displaced: Player | null,
  ctx: SwapContext
): SwapResult {
  const toCard = state.cards.find((c) => c.id === to.cardId);
  if (!toCard || to.index >= cardMax(toCard)) return { ok: false, message: null };
  if (isInAnyCard(state.cards, mover.id)) {
    return { ok: false, message: `${mover.name} is already in a card` };
  }

  let queue = state.queue;
  let bench = state.bench;
  if (from.kind === "bench") {
    const entry = state.bench.find((e) => e.player.id === mover.id);
    bench = state.bench.filter((e) => e.player.id !== mover.id);
    queue = [
      ...state.queue,
      makeQueueEntry(mover, entry?.sessionJoinedAt ?? ctx.now, ctx),
    ].map((e, i) => ({ ...e, position: i + 1 }));
  }

  const cards = applyCardWrites(state.cards, [
    { cardId: to.cardId, side: to.side, index: to.index, player: mover },
  ]);
  // A plain placement stays silent; a replace costs someone their spot, so it
  // gets a toast and an undo.
  return {
    ok: true,
    next: { ...state, queue, bench, cards },
    message: displaced ? `${mover.name} replaced ${displaced.name} in the matchup` : null,
    undoLabel: displaced ? "Undo replace" : null,
  };
}

// ── queue | bench | card → court ────────────────────────────────────────────
// Substitution. The outgoing player goes to the *bench*, not the queue: leaving
// a live match means resting, and this direction never named a destination for
// them. (Court-as-source below does name one, and honors it.)
function intoCourt(
  state: RosterState,
  from: Extract<Endpoint, { kind: "queue" | "bench" | "card" }>,
  to: Extract<Endpoint, { kind: "court" }>,
  mover: Player,
  displaced: Player | null,
  ctx: SwapContext
): SwapResult {
  if (!displaced) return { ok: false, message: null };
  const court = state.courts.find((c) => c.id === to.courtId);
  if (!court?.activeMatch) return { ok: false, message: null };
  const roster = [...court.activeMatch.sideA, ...court.activeMatch.sideB];
  if (roster.some((p) => p.id === mover.id)) {
    return { ok: false, message: `${mover.name} is already in this match` };
  }
  // A queue row can represent a player already placed in a planning card
  // (placement doesn't remove the queue entry), and pulling them onto a court
  // from here would leave them double-booked. Reached via the chip instead.
  if (from.kind !== "card" && isInAnyCard(state.cards, mover.id)) {
    return { ok: false, message: `${mover.name} is already in a matchup card` };
  }

  const joinedAt = sessionJoinedAtOf(state, mover.id, ctx.now);

  const queue = removeFromQueue(state.queue, mover.id);
  let bench = state.bench.filter((e) => e.player.id !== mover.id);
  bench = [
    ...bench,
    {
      id: ctx.newId("b"),
      player: displaced,
      sessionJoinedAt: sessionJoinedAtOf(state, displaced.id, ctx.now),
    },
  ];

  const cards =
    from.kind === "card"
      ? applyCardWrites(state.cards, [
          { cardId: from.cardId, side: from.side, index: from.index, player: null },
        ])
      : state.cards;

  const courts = applyCourtWrites(state.courts, [
    { courtId: to.courtId, side: to.side, index: to.index, player: mover, sessionJoinedAt: joinedAt },
  ]);

  return {
    ok: true,
    next: { queue, bench, cards, courts },
    message: `${mover.name} subbed in for ${displaced.name}`,
    undoLabel: "Undo substitution",
  };
}

// ── court → anywhere ────────────────────────────────────────────────────────
// The new direction. A court player can only ever *swap*: they may take another
// occupied position, and whoever was there takes their spot on the court.
function fromCourt(
  state: RosterState,
  from: Extract<Endpoint, { kind: "court" }>,
  to: Endpoint,
  mover: Player,
  displaced: Player | null,
  ctx: SwapContext
): SwapResult {
  const fromCourtCard = state.courts.find((c) => c.id === from.courtId);
  if (!fromCourtCard?.activeMatch) return { ok: false, message: null };
  if (!displaced) return { ok: false, message: REJECT_COURT_TO_EMPTY };

  const moverJoinedAt = sessionJoinedAtOf(state, mover.id, ctx.now);
  const displacedJoinedAt = sessionJoinedAtOf(state, displaced.id, ctx.now);

  if (to.kind === "court") {
    const toCourtCard = state.courts.find((c) => c.id === to.courtId);
    if (!toCourtCard?.activeMatch) return { ok: false, message: null };
    const courts = applyCourtWrites(state.courts, [
      {
        courtId: from.courtId,
        side: from.side,
        index: from.index,
        player: displaced,
        sessionJoinedAt: displacedJoinedAt,
      },
      {
        courtId: to.courtId,
        side: to.side,
        index: to.index,
        player: mover,
        sessionJoinedAt: moverJoinedAt,
      },
    ]);
    const message =
      from.courtId === to.courtId
        ? `Swapped ${mover.name} and ${displaced.name} on ${courtLabel(fromCourtCard)}`
        : `Swapped ${mover.name} (${courtLabel(fromCourtCard)}) and ${displaced.name} (${courtLabel(toCourtCard)})`;
    return { ok: true, next: { ...state, courts }, message, undoLabel: "Undo swap" };
  }

  // Everything below moves the court player into the pool and pulls the target
  // player onto the court in their place.
  const courts = applyCourtWrites(state.courts, [
    {
      courtId: from.courtId,
      side: from.side,
      index: from.index,
      player: displaced,
      sessionJoinedAt: displacedJoinedAt,
    },
  ]);

  if (to.kind === "queue") {
    if (isInAnyCard(state.cards, displaced.id)) {
      return { ok: false, message: `${displaced.name} is already in a matchup card` };
    }
    const index = state.queue.findIndex((e) => e.player.id === displaced.id);
    if (index === -1) return { ok: false, message: null };
    const queue = replaceQueueEntryAt(
      state.queue,
      index,
      makeQueueEntry(mover, moverJoinedAt, ctx)
    );
    return {
      ok: true,
      next: { ...state, queue, courts },
      message: `${displaced.name} subbed into ${courtLabel(fromCourtCard)}, ${mover.name} moved to the queue`,
      undoLabel: "Undo swap",
    };
  }

  if (to.kind === "bench") {
    const index = state.bench.findIndex((e) => e.player.id === displaced.id);
    if (index === -1) return { ok: false, message: null };
    const bench = [...state.bench];
    bench[index] = { id: ctx.newId("b"), player: mover, sessionJoinedAt: moverJoinedAt };
    return {
      ok: true,
      next: { ...state, bench, courts },
      message: `${displaced.name} subbed into ${courtLabel(fromCourtCard)}, ${mover.name} moved to the bench`,
      undoLabel: "Undo swap",
    };
  }

  // to.kind === "card" — the displaced player holds both a card slot and the
  // queue entry behind it, so the mover inherits both.
  const queueIndex = state.queue.findIndex((e) => e.player.id === displaced.id);
  const queue =
    queueIndex === -1
      ? [...state.queue, makeQueueEntry(mover, moverJoinedAt, ctx)].map((e, i) => ({
          ...e,
          position: i + 1,
        }))
      : replaceQueueEntryAt(state.queue, queueIndex, makeQueueEntry(mover, moverJoinedAt, ctx));
  const cards = applyCardWrites(state.cards, [
    { cardId: to.cardId, side: to.side, index: to.index, player: mover },
  ]);
  return {
    ok: true,
    next: { ...state, queue, cards, courts },
    message: `${displaced.name} subbed into ${courtLabel(fromCourtCard)}, ${mover.name} moved to a matchup card`,
    undoLabel: "Undo swap",
  };
}
