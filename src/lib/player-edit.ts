import type { BenchEntry, Court, MatchRecord, PlanningCard, Player, QueueEntry } from "@/types";

/** The fields the organiser can change from the player menu's Edit. */
export type PlayerDetailsPatch = Partial<Pick<Player, "name" | "skillLevel" | "gender" | "notes">>;

/**
 * Pure helpers that apply one player's edit to every live copy of them.
 *
 * A player is stored as up to three independent copies during a session:
 * their queue or bench entry, a copy inside any matchup card they're placed
 * in, and a copy inside a live court match (court assignment removes the
 * queue entry). Editing only the first used to leave a card or court showing
 * the old name, and the card then carried that stale name onto the court.
 *
 * Every helper returns the input unchanged by reference when the player isn't
 * in it, so a no-op edit doesn't hand React fresh arrays and re-render the
 * whole dashboard.
 */

function patchPlayer(player: Player, playerId: string, patch: PlayerDetailsPatch): Player {
  return player.id === playerId ? { ...player, ...patch } : player;
}

function patchSide<T extends Player | null>(side: T[], playerId: string, patch: PlayerDetailsPatch): T[] {
  let changed = false;
  const next = side.map((p) => {
    if (!p || p.id !== playerId) return p;
    changed = true;
    return patchPlayer(p, playerId, patch) as T;
  });
  return changed ? next : side;
}

export function patchEntries<T extends QueueEntry | BenchEntry>(
  entries: T[],
  playerId: string,
  patch: PlayerDetailsPatch
): T[] {
  if (!entries.some((e) => e.player.id === playerId)) return entries;
  return entries.map((e) =>
    e.player.id === playerId ? { ...e, player: patchPlayer(e.player, playerId, patch) } : e
  );
}

export function patchCards(cards: PlanningCard[], playerId: string, patch: PlayerDetailsPatch): PlanningCard[] {
  let changed = false;
  const next = cards.map((card) => {
    if (!card.suggestion) return card;
    const sideA = patchSide(card.suggestion.sideA, playerId, patch);
    const sideB = patchSide(card.suggestion.sideB, playerId, patch);
    if (sideA === card.suggestion.sideA && sideB === card.suggestion.sideB) return card;
    changed = true;
    return { ...card, suggestion: { ...card.suggestion, sideA, sideB } };
  });
  return changed ? next : cards;
}

export function patchCourts(courts: Court[], playerId: string, patch: PlayerDetailsPatch): Court[] {
  let changed = false;
  const next = courts.map((court) => {
    const match = court.activeMatch;
    if (!match) return court;
    const sideA = patchSide(match.sideA, playerId, patch);
    const sideB = patchSide(match.sideB, playerId, patch);
    if (sideA === match.sideA && sideB === match.sideB) return court;
    changed = true;
    return { ...court, activeMatch: { ...match, sideA, sideB } };
  });
  return changed ? next : courts;
}

/**
 * Carries a name correction into finished matches. Name only, on purpose.
 *
 * A name is identity, so a typo fix should fix the Matches page and every past
 * row too. Skill level is deliberately left as recorded. Upset bonuses and the
 * awards were earned against the level a player had when they played, and
 * rewriting it would quietly recalculate who won Giant Killer.
 */
export function renameInMatches(matches: MatchRecord[], playerId: string, name: string): MatchRecord[] {
  let changed = false;
  const next = matches.map((m) => {
    const rename = (side: Player[]) =>
      side.some((p) => p.id === playerId && p.name !== name)
        ? side.map((p) => (p.id === playerId ? { ...p, name } : p))
        : side;
    const sideA = rename(m.sideA);
    const sideB = rename(m.sideB);
    if (sideA === m.sideA && sideB === m.sideB) return m;
    changed = true;
    return { ...m, sideA, sideB };
  });
  return changed ? next : matches;
}

export type PlayerLocation =
  | { where: "queue"; entry: QueueEntry }
  | { where: "bench"; entry: BenchEntry }
  | { where: "court"; courtId: string; player: Player }
  | { where: "card"; cardId: string; player: Player };

/**
 * Where a player lives right now, for opening the edit form with current data
 * and deciding which actions are allowed.
 *
 * Queue and bench win over a card, because a carded player is still a queue
 * entry and that entry is the authoritative copy. A court comes before a card
 * because a player on court has no queue entry at all.
 */
export function locatePlayer(
  playerId: string,
  queue: QueueEntry[],
  bench: BenchEntry[],
  courts: Court[],
  cards: PlanningCard[]
): PlayerLocation | null {
  const q = queue.find((e) => e.player.id === playerId && !e.isInMatch);
  if (q) return { where: "queue", entry: q };
  const b = bench.find((e) => e.player.id === playerId);
  if (b) return { where: "bench", entry: b };
  for (const court of courts) {
    const p = [...(court.activeMatch?.sideA ?? []), ...(court.activeMatch?.sideB ?? [])].find(
      (x) => x.id === playerId
    );
    if (p) return { where: "court", courtId: court.id, player: p };
  }
  for (const card of cards) {
    const p = [...(card.suggestion?.sideA ?? []), ...(card.suggestion?.sideB ?? [])].find(
      (x): x is Player => !!x && x.id === playerId
    );
    if (p) return { where: "card", cardId: card.id, player: p };
  }
  return null;
}

export function playerOf(location: PlayerLocation): Player {
  return location.where === "queue" || location.where === "bench" ? location.entry.player : location.player;
}
