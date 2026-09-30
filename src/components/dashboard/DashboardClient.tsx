"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type {
  ActiveMatch,
  BenchEntry,
  Court,
  QueueEntry,
  PlanningCard,
  PlanningCardState,
  MatchType,
  MatchResult,
  MatchRecord,
  MatchupSuggestion,
  Player,
} from "@/types";
import { CourtsSection } from "./CourtsSection";
import { MatchupColumn } from "./MatchupColumn";
import { PlayerPoolColumn } from "./PlayerPoolColumn";
import type { NewPlayerInput } from "./AddPlayersModal";
import {
  addMatchRecord,
  removeMatchRecord,
  renamePlayerInMatchLog,
  useGamesPlayedMap,
  useMatchLog,
} from "@/lib/match-log-store";
import {
  useSessionQueue,
  useSessionBench,
  useSessionCourts,
  useSessionPlanningCards,
  useSmartMatchupSkipCounts,
  useSmartMatchupRoundsSinceServed,
  appendSortedByCheckIn,
  buildDefaultPlanningCards,
  removeQueueEntry,
  removeBenchEntry,
  restoreQueueEntry,
  restoreBenchEntry,
} from "@/lib/session-store";
import {
  patchEntries,
  patchCards,
  patchCourts,
  locatePlayer,
  playerOf,
  type PlayerDetailsPatch,
} from "@/lib/player-edit";
import { PlayerModal } from "@/components/players/PlayerModal";
import {
  PlayerMenu,
  type MenuPoint,
  type PlayerMenuItem,
  type PlayerMenuTarget,
} from "./PlayerMenu";
import { Pencil, Coffee, ListPlus, UserMinus, CornerUpLeft } from "lucide-react";
import { suggestMatchup, type LockedPlacement } from "@/lib/smart-matchup";
import {
  resolveSwap,
  playerAt,
  sameEndpoint,
  type Endpoint,
  type RosterState,
} from "@/lib/roster-swap";
import type { TutorialLiveState } from "@/lib/tutorial-store";
import { useToast, ToastViewport } from "@/components/ui/Toast";

function sideNames(players: Player[]): string {
  return players.map((p) => p.name).join("/");
}

// A player can leave the "available" pool — removed from the session
// entirely, or set aside to the bench — while still sitting in a planning
// card's suggestion (Suggest/manual placement doesn't lock them there any
// more than the queue does). Every such exit point must scrub that player
// out of every card's suggestion, or the card keeps showing someone who's no
// longer in the queue at all.
function clearPlayerFromCards(cards: PlanningCard[], playerId: string): PlanningCard[] {
  return cards.map((card) => {
    if (!card.suggestion) return card;
    const sideA = card.suggestion.sideA.map((p) => (p?.id === playerId ? null : p));
    const sideB = card.suggestion.sideB.map((p) => (p?.id === playerId ? null : p));
    const changed =
      sideA.some((p, i) => p !== card.suggestion!.sideA[i]) ||
      sideB.some((p, i) => p !== card.suggestion!.sideB[i]);
    if (!changed) return card;
    const hasAnyPlayer = [...sideA, ...sideB].some(Boolean);
    return {
      ...card,
      state: hasAnyPlayer ? ("proposed" as const) : ("empty" as const),
      suggestion: hasAnyPlayer ? { ...card.suggestion, sideA, sideB } : null,
    };
  });
}

function buildActiveMatch(
  card: PlanningCard,
  court: Court,
  sessionJoinedAtByPlayer: Record<string, string>
): ActiveMatch {
  const sideA = (card.suggestion?.sideA ?? []).filter((p): p is Player => p !== null);
  const sideB = (card.suggestion?.sideB ?? []).filter((p): p is Player => p !== null);
  return {
    id: `m-${Date.now()}`,
    courtId: court.id,
    courtName: `Court ${court.number}`,
    matchType: card.matchType,
    sideA,
    sideB,
    startedAt: new Date().toISOString(),
    sessionJoinedAtByPlayer,
  };
}

interface Props {
  sessionId: string;
  onTutorialCheck: (state: TutorialLiveState) => void;
}

export type SlotAddress = { cardId: string; side: "A" | "B"; index: number };
export type CourtSlotAddress = { courtId: string; side: "A" | "B"; index: number };

// One dataTransfer type for every drag origin. Before court rows became a swap
// source there were two (x-player for queue rows, x-slot for placed chips) and
// each drop target parsed both; a third would have made every target a
// three-branch parse. The payload is a roster-swap Endpoint, so a drop is just
// `resolveSwap(dragged, target)` regardless of where the drag started.
export const ENDPOINT_MIME = "application/x-endpoint";

export function readEndpointPayload(e: React.DragEvent): Endpoint | null {
  const raw = e.dataTransfer.getData(ENDPOINT_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Endpoint;
  } catch {
    return null;
  }
}

export function writeEndpointPayload(e: React.DragEvent, endpoint: Endpoint) {
  e.dataTransfer.setData(ENDPOINT_MIME, JSON.stringify(endpoint));
  // The payload itself is unreadable during dragover (getData is blocked until
  // drop), but the *list of types* is readable — so the origin kind rides in a
  // second, valueless type. That's what lets an empty planning-card slot stay
  // visually inert for a court player instead of lighting up and then rejecting
  // the drop it just advertised.
  e.dataTransfer.setData(`${ENDPOINT_MIME}-${endpoint.kind}`, "1");
  e.dataTransfer.effectAllowed = "move";
}

// Which kind of position a drag started from, readable during dragover (the
// payload itself is not). Drop targets need this to decide whether to light up
// at all: a target that highlights and then refuses the drop is worse than one
// that never highlights.
export function dragEndpointKind(e: React.DragEvent): Endpoint["kind"] | null {
  const types = Array.from(e.dataTransfer.types);
  for (const kind of ["queue", "bench", "card", "court"] as const) {
    if (types.includes(`${ENDPOINT_MIME}-${kind}`)) return kind;
  }
  return null;
}

export function DashboardClient({ sessionId, onTutorialCheck }: Props) {
  const [courts, setCourts] = useSessionCourts([]);
  const [queue, setQueue] = useSessionQueue([]);
  const [planningCards, setPlanningCards] = useSessionPlanningCards(buildDefaultPlanningCards());
  const [bench, setBench] = useSessionBench([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  // A single armed position, not one state per source kind. Selection lives
  // here rather than inside any one panel because a swap can cross panels —
  // a court row armed here can land on a chip in the Matchups column or a row
  // in the Players column.
  const [selection, setSelection] = useState<Endpoint | null>(null);
  // Counts genuine relocate/swap actions — not a proxy like "2+ players
  // placed" (which Suggest can satisfy in one click, letting the tutorial's
  // Relocate step advance without the organizer ever doing one). Only
  // handleRelocatePlacedPlayer's real success path increments this.
  const [relocateEventCount, setRelocateEventCount] = useState(0);
  // A Set, not a single id — Suggest All can touch several cards in one
  // pass, and each one gets the same click-acknowledged pulse a single
  // Suggest/Resuggest would.
  const [justSuggestedCardIds, setJustSuggestedCardIds] = useState<Set<string>>(new Set());
  const justSuggestedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast, showToast, dismissAndUndo } = useToast();
  const gamesPlayedMap = useGamesPlayedMap();

  useEffect(() => {
    return () => {
      if (justSuggestedTimerRef.current) clearTimeout(justSuggestedTimerRef.current);
    };
  }, []);

  // Feedback for a just-clicked Suggest/Resuggest — pulses the touched card's
  // border even when the algorithm couldn't fill it, so the click always
  // reads as acknowledged. See .animate-suggest-pulse in globals.css.
  const triggerSuggestPulse = useCallback((cardIds: string[]) => {
    if (justSuggestedTimerRef.current) clearTimeout(justSuggestedTimerRef.current);
    setJustSuggestedCardIds(new Set(cardIds));
    justSuggestedTimerRef.current = setTimeout(() => setJustSuggestedCardIds(new Set()), 2200);
  }, []);
  const matches = useMatchLog();
  const [skipCounts, setSkipCounts] = useSmartMatchupSkipCounts();
  const [roundsSinceServed, setRoundsSinceServed] = useSmartMatchupRoundsSinceServed();
  const sessionMatches = useMemo(
    () => matches.filter((m) => m.sessionId === sessionId),
    [matches, sessionId]
  );

  // Reports live session state to the tutorial engine on every change so a
  // gated step (steps 2 onward — step 1 is checked one level up in page.tsx,
  // before this component even mounts) can auto-advance the moment its
  // condition is met. Session-scoped matches, not the full cross-session
  // log, so the FIFO-return step only fires off something that happened in
  // this actual session.
  useEffect(() => {
    onTutorialCheck({
      hasSession: true,
      queue,
      bench,
      planningCards,
      courts,
      matches: sessionMatches,
      relocateEventCount,
    });
  }, [onTutorialCheck, queue, bench, planningCards, courts, sessionMatches, relocateEventCount]);

  // Every player currently part of this session — queue, bench, and anyone
  // mid-match — so AddPlayersModal can block a duplicate name regardless of
  // where the existing player currently sits. Case-sensitive on purpose: an
  // exact-string match, not a normalized/lowercased one.
  const existingPlayerNames = useMemo(() => {
    const names = new Set<string>();
    for (const entry of queue) names.add(entry.player.name);
    for (const entry of bench) names.add(entry.player.name);
    for (const court of courts) {
      if (!court.activeMatch) continue;
      for (const p of [...court.activeMatch.sideA, ...court.activeMatch.sideB]) names.add(p.name);
    }
    return names;
  }, [queue, bench, courts]);

  const slottedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const card of planningCards) {
      if (card.suggestion) {
        for (const p of card.suggestion.sideA) { if (p) ids.add(p.id); }
        for (const p of card.suggestion.sideB) { if (p) ids.add(p.id); }
      }
    }
    return ids;
  }, [planningCards]);

  // playerId -> when they last entered the queue. Matchup chips show waiting
  // time, but a chip only holds a bare Player; enteredQueueAt lives on the
  // QueueEntry behind it, which a carded player still has (placement never
  // removes it).
  // Stable timestamp, not a duration: durations drift as the clock moves, so
  // each ElapsedTimer derives its own live threshold from this instead.
  const queueMedianEnteredAt = useMemo(() => {
    const waiting = queue.filter((e) => !e.isInMatch);
    if (waiting.length === 0) return undefined;
    const times = waiting.map((e) => new Date(e.enteredQueueAt).getTime()).sort((a, b) => a - b);
    const mid = Math.floor(times.length / 2);
    const median = times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
    return new Date(median).toISOString();
  }, [queue]);

  const waitingSince = useMemo(
    () => new Map(queue.map((e) => [e.player.id, e.enteredQueueAt])),
    [queue]
  );

  const rosterState = useMemo<RosterState>(
    () => ({ queue, bench, cards: planningCards, courts }),
    [queue, bench, planningCards, courts]
  );

  const selectedChip: SlotAddress | null =
    selection?.kind === "card"
      ? { cardId: selection.cardId, side: selection.side, index: selection.index }
      : null;
  const selectedCourtSlot: CourtSlotAddress | null =
    selection?.kind === "court"
      ? { courtId: selection.courtId, side: selection.side, index: selection.index }
      : null;
  const selectedPoolPlayerId =
    selection?.kind === "queue" || selection?.kind === "bench" ? selection.playerId : null;
  // Deliberately NOT `selectedPlayer` — an empty planning-card slot may only
  // light up as a drop target for a pool player. A court player armed for a
  // swap can't land there (a live match can't be left short), so treating any
  // armed player as placeable would advertise a move that gets rejected.
  const selectedPoolPlayer = useMemo(
    () => (selectedPoolPlayerId ? playerAt(rosterState, selection!) : null),
    [rosterState, selection, selectedPoolPlayerId]
  );

  // Every move in the three panels funnels through here: resolve against the
  // current roster, apply the result wholesale, and offer a single undo that
  // restores the exact prior state. The old per-handler undos each rebuilt
  // their own inverse by hand, which is where the queue-entry bookkeeping was
  // easiest to get subtly wrong.
  const applySwap = useCallback(
    (from: Endpoint, to: Endpoint) => {
      const before = rosterState;
      const result = resolveSwap(before, from, to);
      if (!result.ok) {
        if (result.message) showToast(result.message);
        setSelection(null);
        return;
      }
      const { next } = result;
      if (next.queue !== before.queue) setQueue(next.queue);
      if (next.bench !== before.bench) setBench(next.bench);
      if (next.cards !== before.cards) setPlanningCards(next.cards);
      if (next.courts !== before.courts) setCourts(next.courts);
      // Only card-to-card moves count as the tutorial's "relocate" gesture —
      // the same restriction the old handleRelocatePlacedPlayer enforced.
      if (from.kind === "card" && to.kind === "card") setRelocateEventCount((c) => c + 1);
      if (result.message) {
        showToast(
          result.message,
          () => {
            setQueue(before.queue);
            setBench(before.bench);
            setPlanningCards(before.cards);
            setCourts(before.courts);
          },
          result.undoLabel ?? undefined
        );
      }
      setSelection(null);
    },
    [rosterState, showToast, setQueue, setBench, setPlanningCards, setCourts]
  );

  // Tap-to-place: touch-friendly alternative to dragging a player onto a card.
  const handleSelectPlayer = useCallback(
    (player: Player) => {
      const onBench = bench.some((e) => e.player.id === player.id);
      const next: Endpoint = onBench
        ? { kind: "bench", playerId: player.id }
        : { kind: "queue", playerId: player.id };
      setSelection((prev) => (prev && sameEndpoint(prev, next) ? null : next));
    },
    [bench]
  );

  // A queue/bench row is a swap target too now, not just a drag source: an
  // armed court player dropped here takes this row's position.
  const handlePoolRowActivate = useCallback(
    (player: Player) => {
      const onBench = bench.some((e) => e.player.id === player.id);
      const target: Endpoint = onBench
        ? { kind: "bench", playerId: player.id }
        : { kind: "queue", playerId: player.id };
      if (selection && selection.kind === "court") {
        applySwap(selection, target);
        return;
      }
      handleSelectPlayer(player);
    },
    [bench, selection, applySwap, handleSelectPlayer]
  );

  const handleQueueRemove = useCallback(
    (id: string) => {
      const entry = queue.find((e) => e.id === id);

      setQueue((prev) =>
        prev.filter((e) => e.id !== id).map((e, i) => ({ ...e, position: i + 1 }))
      );

      // A removed player may already be sitting in a planning card's
      // suggestion — leaving them there would show someone no longer in the
      // session at all, and let a stale chip get assigned to a court.
      if (entry) {
        setPlanningCards((prev) => clearPlayerFromCards(prev, entry.player.id));
      }
    },
    [queue, setQueue, setPlanningCards]
  );

  const handleBenchReturnToQueue = useCallback((id: string) => {
    const entry = bench.find((e) => e.id === id);
    if (!entry) return;

    setBench((prev) => prev.filter((e) => e.id !== id));
    setQueue((prev) =>
      appendSortedByCheckIn(prev, [
        {
          id: `q-${Date.now()}`,
          player: entry.player,
          position: 0,
          isInMatch: false,
          sessionJoinedAt: entry.sessionJoinedAt,
          enteredQueueAt: new Date().toISOString(),
        },
      ])
    );
  }, [bench, setBench, setQueue]);

  const handleAddPlayers = useCallback((newPlayers: NewPlayerInput[]) => {
    const now = Date.now();
    const newEntries: QueueEntry[] = newPlayers.map((p, i) => ({
      id: `q-${now}-${i}`,
      player: {
        id: `p-${now}-${i}`,
        name: p.name,
        skillLevel: p.skillLevel,
        gender: p.gender,
        paymentStatus: "UNPAID",
      },
      position: 0,
      isInMatch: false,
      // Staggered so simultaneously-added rows keep the order they were typed in.
      sessionJoinedAt: new Date(now + i).toISOString(),
      enteredQueueAt: new Date(now + i).toISOString(),
    }));
    setQueue((prev) => appendSortedByCheckIn(prev, newEntries));
    showToast(
      newEntries.length > 1
        ? `Added ${newEntries.length} players to queue`
        : `Added ${newEntries[0].player.name} to queue`
    );
  }, [showToast, setQueue]);

  const handleMoveToBench = useCallback((id: string) => {
    const entry = queue.find((e) => e.id === id);
    if (!entry) return;
    const { player, sessionJoinedAt } = entry;

    setQueue((prev) =>
      prev.filter((e) => e.id !== id).map((e, i) => ({ ...e, position: i + 1 }))
    );

    setPlanningCards((prev) => clearPlayerFromCards(prev, player.id));

    setBench((prev) => [
      ...prev,
      { id: `b-${Date.now()}`, player, sessionJoinedAt },
    ]);

    showToast("Moved to bench");
  }, [queue, showToast, setQueue, setBench, setPlanningCards]);

  const handleBenchRemove = useCallback(
    (id: string) => {
      const entry = bench.find((e) => e.id === id);

      setBench((prev) => prev.filter((e) => e.id !== id));

      // Bench players can be dragged into a planning card manually too (see
      // docs/specs), so removal here needs the same card cleanup as queue
      // removal above.
      if (entry) {
        setPlanningCards((prev) => clearPlayerFromCards(prev, entry.player.id));
      }
    },
    [bench, setBench, setPlanningCards]
  );

  const handleCardDismiss = useCallback((id: string) => {
    setPlanningCards((prev) => prev.filter((c) => c.id !== id));
  }, [setPlanningCards]);

  const handleCardMatchTypeChange = useCallback(
    (id: string, type: MatchType) => {
      if (type === "SINGLES") {
        const card = planningCards.find((c) => c.id === id);
        if (card?.suggestion) {
          const removedCount = [card.suggestion.sideA[1], card.suggestion.sideB[1]].filter(
            Boolean
          ).length;
          if (removedCount > 0) {
            const originalCard = card;
            showToast(
              `Switched to 1v1 — removed ${removedCount} player${removedCount !== 1 ? "s" : ""}`,
              () => {
                setPlanningCards((prev) =>
                  prev.map((c) => (c.id === id ? originalCard : c))
                );
              },
              "Undo switch to singles"
            );
          }
        }
      }

      setPlanningCards((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          if (type === "SINGLES" && c.suggestion) {
            const sideA: (Player | null)[] = [c.suggestion.sideA[0] ?? null];
            const sideB: (Player | null)[] = [c.suggestion.sideB[0] ?? null];
            const hasAny = !!(sideA[0] || sideB[0]);
            const isReady = !!(sideA[0] && sideB[0]);
            return {
              ...c,
              matchType: type,
              state: isReady ? ("ready" as const) : hasAny ? ("proposed" as const) : ("empty" as const),
              suggestion: hasAny ? { sideA, sideB, pairsExhausted: false } : null,
            };
          }
          return { ...c, matchType: type, state: "proposed" as const };
        })
      );
    },
    [planningCards, showToast, setPlanningCards]
  );

  // Single decision point for every planning-card slot tap: an occupied slot
  // with nothing armed *starts* a selection, with something armed it resolves
  // one. Empty slots are destination-only.
  const handleSlotTap = useCallback(
    (cardId: string, side: "A" | "B", index: number) => {
      const target: Endpoint = { kind: "card", cardId, side, index };
      const occupant = playerAt(rosterState, target);

      if (occupant) {
        if (selection && sameEndpoint(selection, target)) {
          setSelection(null);
          return;
        }
        if (selection) {
          applySwap(selection, target);
          return;
        }
        setSelection(target);
        return;
      }

      if (selection) applySwap(selection, target);
    },
    [rosterState, selection, applySwap]
  );
  const handleRemovePlayerFromCard = useCallback(
    (cardId: string, side: "A" | "B", index: number) => {
      setPlanningCards((prev) =>
        prev.map((card) => {
          if (card.id !== cardId || !card.suggestion) return card;
          const sideA = [...card.suggestion.sideA];
          const sideB = [...card.suggestion.sideB];
          if (side === "A") sideA[index] = null;
          else sideB[index] = null;
          const hasAnyPlayer = [...sideA, ...sideB].some(Boolean);
          return {
            ...card,
            state: hasAnyPlayer ? ("proposed" as const) : ("empty" as const),
            suggestion: hasAnyPlayer ? { ...card.suggestion, sideA, sideB } : null,
          };
        })
      );
    },
    [setPlanningCards]
  );

  // ── Player menu and editing ─────────────────────────────────────────────
  // One menu and one edit form for every place a player appears: the player
  // column, a matchup card, or a live court. They used to be editable only
  // from the column, and that edit only reached the queue entry.
  const [playerMenu, setPlayerMenu] = useState<{ target: PlayerMenuTarget; point: MenuPoint } | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const openPlayerMenu = useCallback((target: PlayerMenuTarget, point: MenuPoint) => {
    setPlayerMenu({ target, point });
  }, []);

  const openEditPlayer = useCallback((playerId: string) => {
    setEditingPlayerId(playerId);
    setIsEditOpen(true);
  }, []);

  const closeEditPlayer = useCallback(() => {
    setIsEditOpen(false);
    // Kept until the close transition finishes, so the form doesn't empty mid-fade.
    setTimeout(() => setEditingPlayerId(null), 220);
  }, []);

  // Re-derived from live state on every render, so the form always shows the
  // player's current details even if they move from the queue to a court
  // while it's open.
  const editingLocation = useMemo(
    () =>
      editingPlayerId ? locatePlayer(editingPlayerId, queue, bench, courts, planningCards) : null,
    [editingPlayerId, queue, bench, courts, planningCards]
  );

  /**
   * Applies an edit to every live copy of the player at once: their queue or
   * bench entry, any matchup card holding them, and a live court match. A
   * name change also corrects finished matches; a skill change deliberately
   * doesn't, so past upset bonuses stay as they were earned. See player-edit.ts.
   */
  const handleEditSave = useCallback(
    (data: { name: string; skillLevel: Player["skillLevel"]; gender?: Player["gender"]; notes: string }) => {
      if (!editingPlayerId) return;
      const before = editingLocation ? playerOf(editingLocation) : null;
      const patch: PlayerDetailsPatch = {
        name: data.name,
        skillLevel: data.skillLevel,
        gender: data.gender,
        notes: data.notes || undefined,
      };
      setQueue((prev) => patchEntries(prev, editingPlayerId, patch));
      setBench((prev) => patchEntries(prev, editingPlayerId, patch));
      setPlanningCards((prev) => patchCards(prev, editingPlayerId, patch));
      setCourts((prev) => patchCourts(prev, editingPlayerId, patch));
      if (before && before.name !== data.name) renamePlayerInMatchLog(editingPlayerId, data.name);
    },
    [editingPlayerId, editingLocation, setQueue, setBench, setPlanningCards, setCourts]
  );

  const removeFromSession = useCallback(
    (playerId: string) => {
      const loc = locatePlayer(playerId, queue, bench, courts, planningCards);
      if (!loc || (loc.where !== "queue" && loc.where !== "bench")) return;
      const removed = loc.where === "queue" ? removeQueueEntry(loc.entry.id) : removeBenchEntry(loc.entry.id);
      if (!removed) return;
      // A removed player can't stay in a matchup card, or the card would send
      // someone no longer in the session onto a court.
      setPlanningCards((prev) => clearPlayerFromCards(prev, playerId));
      showToast(
        `Removed ${removed.player.name.split(" ")[0]} from the session`,
        () =>
          loc.where === "queue"
            ? restoreQueueEntry(removed as QueueEntry)
            : restoreBenchEntry(removed as BenchEntry),
        "Undo remove from session"
      );
    },
    [queue, bench, courts, planningCards, setPlanningCards, showToast]
  );

  /**
   * The menu's actions depend on where the player was when it opened. Edit is
   * always first. A player on court has nothing else here: swapping already
   * works by tap, and removing someone mid-match would orphan the match.
   */
  const playerMenuItems = useMemo((): PlayerMenuItem[] => {
    if (!playerMenu) return [];
    const { target } = playerMenu;
    const edit: PlayerMenuItem = {
      key: "edit",
      label: "Edit player",
      icon: Pencil,
      onSelect: () => openEditPlayer(target.playerId),
    };
    if (target.where === "court") return [edit];
    if (target.where === "card") {
      return [
        edit,
        {
          key: "uncard",
          label: "Take out of card",
          icon: CornerUpLeft,
          onSelect: () => handleRemovePlayerFromCard(target.cardId, target.side, target.index),
        },
      ];
    }
    const loc = locatePlayer(target.playerId, queue, bench, courts, planningCards);
    const remove: PlayerMenuItem = {
      key: "remove",
      label: "Remove from session",
      icon: UserMinus,
      danger: true,
      onSelect: () => removeFromSession(target.playerId),
    };
    if (loc?.where === "queue") {
      const entryId = loc.entry.id;
      return [
        edit,
        { key: "rest", label: "Rest on bench", icon: Coffee, onSelect: () => handleMoveToBench(entryId) },
        remove,
      ];
    }
    if (loc?.where === "bench") {
      const entryId = loc.entry.id;
      return [
        edit,
        { key: "queue", label: "Back to queue", icon: ListPlus, onSelect: () => handleBenchReturnToQueue(entryId) },
        remove,
      ];
    }
    return [edit];
  }, [
    playerMenu,
    queue,
    bench,
    courts,
    planningCards,
    openEditPlayer,
    handleRemovePlayerFromCard,
    handleMoveToBench,
    handleBenchReturnToQueue,
    removeFromSession,
  ]);

  const playerMenuTitle = useMemo(() => {
    if (!playerMenu) return "";
    const loc = locatePlayer(playerMenu.target.playerId, queue, bench, courts, planningCards);
    return loc ? playerOf(loc).name : "Player";
  }, [playerMenu, queue, bench, courts, planningCards]);

  const handleCardAssign = useCallback(
    (cardId: string, courtId: string) => {
      const targetCourt = courts.find((c) => c.id === courtId);
      const originalCard = planningCards.find((c) => c.id === cardId);
      const originalIndex = planningCards.findIndex((c) => c.id === cardId);
      const newEmptyId = `pc-${Date.now()}`;
      let removedQueueEntries: QueueEntry[] = [];

      if (targetCourt && originalCard) {
        const sideAPlayers = (originalCard.suggestion?.sideA ?? []).filter((p): p is Player => p !== null);
        const sideBPlayers = (originalCard.suggestion?.sideB ?? []).filter((p): p is Player => p !== null);
        const matchPlayerIds = new Set([...sideAPlayers, ...sideBPlayers].map((p) => p.id));

        setQueue((prev) => {
          removedQueueEntries = prev.filter((e) => matchPlayerIds.has(e.player.id));
          return prev
            .filter((e) => !matchPlayerIds.has(e.player.id))
            .map((e, i) => ({ ...e, position: i + 1 }));
        });

        const sessionJoinedAtByPlayer: Record<string, string> = {};
        for (const entry of removedQueueEntries) {
          sessionJoinedAtByPlayer[entry.player.id] = entry.sessionJoinedAt;
        }
        const activeMatch = buildActiveMatch(originalCard, targetCourt, sessionJoinedAtByPlayer);
        setCourts((prev) =>
          prev.map((c) => (c.id === courtId ? { ...c, status: "IN_USE" as const, activeMatch } : c))
        );
      }
      setPlanningCards((prev) => {
        const remaining = prev.filter((c) => c.id !== cardId);
        return [
          ...remaining,
          { id: newEmptyId, matchType: "DOUBLES" as const, state: "empty" as const, suggestion: null },
        ];
      });

      if (targetCourt) {
        showToast(
          `Assigned → Court ${targetCourt.number}`,
          originalCard
            ? () => {
                setCourts((prev) =>
                  prev.map((c) =>
                    c.id === courtId ? { ...c, status: "AVAILABLE" as const, activeMatch: undefined } : c
                  )
                );
                setQueue((prev) =>
                  appendSortedByCheckIn(
                    prev,
                    removedQueueEntries.map((e) => ({ ...e, enteredQueueAt: new Date().toISOString() }))
                  )
                );
                setPlanningCards((prev) => {
                  const withoutNew = prev.filter((c) => c.id !== newEmptyId);
                  const insertAt = Math.min(originalIndex, withoutNew.length);
                  return [
                    ...withoutNew.slice(0, insertAt),
                    originalCard,
                    ...withoutNew.slice(insertAt),
                  ];
                });
              }
            : undefined,
          "Undo court assignment"
        );
      }
    },
    [courts, planningCards, showToast, setQueue, setCourts, setPlanningCards]
  );

  const handleCourtDrop = useCallback(
    (courtId: string) => {
      if (!draggingCardId) return;
      const targetCourt = courts.find((c) => c.id === courtId);
      const originalCard = planningCards.find((c) => c.id === draggingCardId);
      const originalIndex = planningCards.findIndex((c) => c.id === draggingCardId);
      const newEmptyId = `pc-${Date.now()}`;
      let removedQueueEntries: QueueEntry[] = [];

      if (targetCourt && originalCard) {
        const sideAPlayers = (originalCard.suggestion?.sideA ?? []).filter((p): p is Player => p !== null);
        const sideBPlayers = (originalCard.suggestion?.sideB ?? []).filter((p): p is Player => p !== null);
        const matchPlayerIds = new Set([...sideAPlayers, ...sideBPlayers].map((p) => p.id));

        setQueue((prev) => {
          removedQueueEntries = prev.filter((e) => matchPlayerIds.has(e.player.id));
          return prev
            .filter((e) => !matchPlayerIds.has(e.player.id))
            .map((e, i) => ({ ...e, position: i + 1 }));
        });

        const sessionJoinedAtByPlayer: Record<string, string> = {};
        for (const entry of removedQueueEntries) {
          sessionJoinedAtByPlayer[entry.player.id] = entry.sessionJoinedAt;
        }
        const activeMatch = buildActiveMatch(originalCard, targetCourt, sessionJoinedAtByPlayer);
        setCourts((prev) =>
          prev.map((c) => (c.id === courtId ? { ...c, status: "IN_USE" as const, activeMatch } : c))
        );
      }
      setPlanningCards((prev) => {
        const remaining = prev.filter((c) => c.id !== draggingCardId);
        return [
          ...remaining,
          { id: newEmptyId, matchType: "DOUBLES" as const, state: "empty" as const, suggestion: null },
        ];
      });
      setDraggingCardId(null);

      if (targetCourt) {
        showToast(
          `Assigned → Court ${targetCourt.number}`,
          originalCard
            ? () => {
                setCourts((prev) =>
                  prev.map((c) =>
                    c.id === courtId ? { ...c, status: "AVAILABLE" as const, activeMatch: undefined } : c
                  )
                );
                setQueue((prev) =>
                  appendSortedByCheckIn(
                    prev,
                    removedQueueEntries.map((e) => ({ ...e, enteredQueueAt: new Date().toISOString() }))
                  )
                );
                setPlanningCards((prev) => {
                  const withoutNew = prev.filter((c) => c.id !== newEmptyId);
                  const insertAt = Math.min(originalIndex, withoutNew.length);
                  return [
                    ...withoutNew.slice(0, insertAt),
                    originalCard,
                    ...withoutNew.slice(insertAt),
                  ];
                });
              }
            : undefined,
          "Undo court assignment"
        );
      }
    },
    [draggingCardId, courts, planningCards, showToast, setQueue, setCourts, setPlanningCards]
  );

  const handleAddCard = useCallback(() => {
    setPlanningCards((prev) => [
      ...prev,
      { id: `pc-${Date.now()}`, matchType: "DOUBLES" as const, state: "empty" as const, suggestion: null },
    ]);
  }, [setPlanningCards]);

  // Pure algorithm call (see docs/specs/07-smart-matchup.md); this hook owns
  // threading the returned skip counts back into the persisted store.
  const runSmartSuggest = useCallback(
    (matchType: MatchType, excludedPlayerIds: string[], lockedPlacement?: LockedPlacement) => {
      const result = suggestMatchup({
        queue,
        matches: sessionMatches,
        matchType,
        excludedPlayerIds,
        skipCounts,
        gamesPlayedMap,
        lockedPlacement,
        roundsSinceServed,
      });
      setSkipCounts(result.updatedSkipCounts);
      setRoundsSinceServed(result.updatedRoundsSinceServed);
      return result.suggestion;
    },
    [queue, sessionMatches, skipCounts, setSkipCounts, gamesPlayedMap, roundsSinceServed, setRoundsSinceServed]
  );

  // The header's single Suggest control: one click fills every card that
  // isn't already `ready` — `empty` cards get a full generate, `proposed`
  // cards get lock-and-fill (their placed players stay put, only the open
  // slots are searched) — threading exclusions across cards as it goes, so
  // no card in the same pass can pick a player another one just claimed.
  // Only adds a new card when every existing one is already `ready`.
  const handleSuggestCard = useCallback(() => {
    const targets = planningCards.filter((c) => c.state !== "ready");

    if (targets.length === 0) {
      const newCardId = `pc-${Date.now()}`;
      const suggestion = runSmartSuggest("DOUBLES", Array.from(slottedPlayerIds));
      setPlanningCards((prev) => [
        ...prev,
        {
          id: newCardId,
          matchType: "DOUBLES" as const,
          state: suggestion ? ("ready" as const) : ("empty" as const),
          suggestion,
        },
      ]);
      triggerSuggestPulse([newCardId]);
      return;
    }

    const claimed = new Set(slottedPlayerIds);
    const updates = new Map<string, { suggestion: MatchupSuggestion | null; state: PlanningCardState }>();
    const touchedIds: string[] = [];

    for (const card of targets) {
      const lockedPlacement = card.state === "proposed" && card.suggestion ? card.suggestion : undefined;
      const suggestion = runSmartSuggest(card.matchType, Array.from(claimed), lockedPlacement);

      if (lockedPlacement) {
        // A null result means the queue can't cover the remaining open
        // slots right now — leave this card's locked players in place
        // rather than wiping a partial card back to empty.
        if (suggestion) {
          updates.set(card.id, { suggestion, state: "ready" });
          touchedIds.push(card.id);
        }
      } else {
        updates.set(card.id, { suggestion, state: suggestion ? "ready" : "empty" });
        touchedIds.push(card.id);
      }

      const filled = suggestion ?? lockedPlacement;
      if (filled) {
        for (const p of [...filled.sideA, ...filled.sideB]) {
          if (p) claimed.add(p.id);
        }
      }
    }

    setPlanningCards((prev) => prev.map((c) => (updates.has(c.id) ? { ...c, ...updates.get(c.id)! } : c)));
    if (touchedIds.length > 0) triggerSuggestPulse(touchedIds);
  }, [planningCards, runSmartSuggest, slottedPlayerIds, setPlanningCards, triggerSuggestPulse]);

  // The per-card Resuggest icon: cross-card aware like the header Suggest
  // (excludes players other cards already claimed), but scoped to just this
  // one card. A `proposed` card locks its current players and fills only
  // the open slots; `ready`/`empty` cards keep the full reshuffle/generate.
  const handleResuggestCard = useCallback(
    (cardId: string) => {
      const card = planningCards.find((c) => c.id === cardId);
      if (!card) return;

      const claimedByOtherCards = new Set(slottedPlayerIds);
      if (card.suggestion) {
        for (const p of [...card.suggestion.sideA, ...card.suggestion.sideB]) {
          if (p) claimedByOtherCards.delete(p.id);
        }
      }

      const isLockAndFill = card.state === "proposed" && card.suggestion !== null;
      const lockedPlacement = isLockAndFill ? card.suggestion! : undefined;
      const suggestion = runSmartSuggest(card.matchType, Array.from(claimedByOtherCards), lockedPlacement);

      setPlanningCards((prev) =>
        prev.map((c) => {
          if (c.id !== cardId) return c;
          if (isLockAndFill) {
            return suggestion ? { ...c, suggestion, state: "ready" as const } : c;
          }
          return { ...c, suggestion, state: suggestion ? ("ready" as const) : ("empty" as const) };
        })
      );
      triggerSuggestPulse([cardId]);
    },
    [planningCards, slottedPlayerIds, runSmartSuggest, setPlanningCards, triggerSuggestPulse]
  );

  const handleAddCourt = useCallback(() => {
    setCourts((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, number: prev.length + 1, status: "AVAILABLE" as const },
    ]);
  }, [setCourts]);

  const handleDeleteCourt = useCallback((id: string) => {
    setCourts((prev) =>
      prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, number: i + 1 }))
    );
  }, [setCourts]);

  const returnMatchPlayersToQueue = useCallback(
    (courtId: string, message: string, onUndo?: () => void) => {
      const originalCourt = courts.find((c) => c.id === courtId);
      if (!originalCourt?.activeMatch) return;
      const { activeMatch } = originalCourt;
      const returning = [...activeMatch.sideA, ...activeMatch.sideB];

      // gamesPlayed is never stored — it's derived from the match record just
      // written to the shared log (see match-log-store's useGamesPlayedMap).
      const newEntries: QueueEntry[] = returning.map((player) => ({
        id: `q-${Date.now()}-${player.id}`,
        player,
        position: 0,
        isInMatch: false,
        sessionJoinedAt: activeMatch.sessionJoinedAtByPlayer[player.id] ?? new Date().toISOString(),
        enteredQueueAt: new Date().toISOString(),
      }));
      const newEntryIds = new Set(newEntries.map((e) => e.id));

      setCourts((prev) =>
        prev.map((c) =>
          c.id === courtId ? { ...c, status: "AVAILABLE" as const, activeMatch: undefined } : c
        )
      );
      setQueue((prev) => appendSortedByCheckIn(prev, newEntries));

      showToast(
        message,
        () => {
          setCourts((prev) => prev.map((c) => (c.id === courtId ? originalCourt : c)));
          setQueue((prev) =>
            prev.filter((e) => !newEntryIds.has(e.id)).map((e, i) => ({ ...e, position: i + 1 }))
          );
          onUndo?.();
        },
        "Undo match result"
      );
    },
    [courts, showToast, setQueue, setCourts]
  );

  // Recorded locally (see src/lib/match-log-store.ts); syncing this log to a real
  // backend at session-close is designed but not yet implemented — see
  // docs/specs/05-queue-matchup.md.
  const handleEndMatch = useCallback(
    (courtId: string, result: MatchResult) => {
      const originalCourt = courts.find((c) => c.id === courtId);
      if (!originalCourt?.activeMatch) return;
      const { activeMatch } = originalCourt;

      const record: MatchRecord = {
        id: `mr-${Date.now()}`,
        sessionId,
        courtName: activeMatch.courtName,
        matchType: activeMatch.matchType,
        sideA: activeMatch.sideA,
        sideB: activeMatch.sideB,
        result,
        status: "COMPLETED",
        startedAt: activeMatch.startedAt,
        endedAt: new Date().toISOString(),
      };
      addMatchRecord(record);

      const winnerLabel =
        result === "DRAW" ? "Draw" : `${sideNames(result === "SIDE_A" ? activeMatch.sideA : activeMatch.sideB)} won`;
      returnMatchPlayersToQueue(courtId, `Match ended — ${winnerLabel}`, () =>
        removeMatchRecord(record.id)
      );
    },
    [courts, returnMatchPlayersToQueue, sessionId]
  );

  const handleVoidMatch = useCallback(
    (courtId: string) => {
      const originalCourt = courts.find((c) => c.id === courtId);
      if (!originalCourt?.activeMatch) return;
      const { activeMatch } = originalCourt;

      const record: MatchRecord = {
        id: `mr-${Date.now()}`,
        sessionId,
        courtName: activeMatch.courtName,
        matchType: activeMatch.matchType,
        sideA: activeMatch.sideA,
        sideB: activeMatch.sideB,
        result: null,
        status: "VOIDED",
        startedAt: activeMatch.startedAt,
        endedAt: new Date().toISOString(),
      };
      addMatchRecord(record);

      returnMatchPlayersToQueue(courtId, "Match voided — players returned to queue", () =>
        removeMatchRecord(record.id)
      );
    },
    [courts, returnMatchPlayersToQueue, sessionId]
  );


  // Court rows are both source and target now. Nothing armed → this tap picks
  // the player up; something armed → it resolves the swap; tapping the armed
  // row itself puts them back down.
  const handleCourtSlotTap = useCallback(
    (courtId: string, side: "A" | "B", index: number) => {
      const target: Endpoint = { kind: "court", courtId, side, index };
      if (selection && sameEndpoint(selection, target)) {
        setSelection(null);
        return;
      }
      if (selection) {
        applySwap(selection, target);
        return;
      }
      if (playerAt(rosterState, target)) setSelection(target);
    },
    [rosterState, selection, applySwap]
  );

  return (
    <>
      {/*
        mobile  → single column, Courts shown FIRST (live timers + end/void are the most
                  time-urgent controls courtside), then Players, then Matchups
        tablet  → courts strip full-width row 1 [md:col-span-2], then Players [4fr] | Matchups [3fr] in row 2
        desktop → Players [21%] | Matchups [21%] | Courts [58%] — all in row 1, courts
                  two-up inside their own panel from `xl:`. Courts still lead, but 70% was
                  more than the split-sides card can use: it bought 447px cards at 1388px
                  while both left panels sat on their ~200px floor. 58% still yields ~368px
                  per card two-up, and hands the difference to the panels that needed it.

        The mobile/desktop Courts block is placed FIRST in the DOM so mobile's single-column
        flow shows it first (both visually and in reading/tab order — using DOM order here
        instead of a CSS `order-*` utility keeps visual order and a11y order in sync).
        At md/lg this block relies on explicit lg:col-start-3 placement (or is hidden at md),
        so moving it earlier in the DOM does not affect tablet or desktop layout.
      */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[4fr_3fr] lg:grid-cols-[21fr_21fr_58fr] gap-4 p-4 items-start">
        {/* Courts — mobile (shown first) and desktop (explicit col 3, row 1) */}
        <div className="md:hidden lg:block lg:col-start-3 lg:row-start-1 lg:h-[calc(100vh-3.5rem)] lg:sticky lg:top-14">
          <CourtsSection
            courts={courts}
            cols={2}
            isDragging={draggingCardId !== null}
            onCourtDrop={handleCourtDrop}
            onAdd={handleAddCourt}
            onDelete={handleDeleteCourt}
            onEndMatch={handleEndMatch}
            onVoidMatch={handleVoidMatch}
            hasArmedSelection={!!selection}
            armedCourtSlot={selectedCourtSlot}
            onEndpointDrop={applySwap}
            onCourtSlotTap={handleCourtSlotTap}
            onOpenPlayerMenu={openPlayerMenu}
            onCancelSelection={() => setSelection(null)}
          />
        </div>

        {/* Tablet courts strip — hidden on mobile/desktop, full-width row 1 on tablet */}
        <div className="hidden md:block lg:hidden md:col-span-2">
          <CourtsSection
            courts={courts}
            horizontal
            isDragging={draggingCardId !== null}
            onCourtDrop={handleCourtDrop}
            onAdd={handleAddCourt}
            onDelete={handleDeleteCourt}
            onEndMatch={handleEndMatch}
            onVoidMatch={handleVoidMatch}
            hasArmedSelection={!!selection}
            armedCourtSlot={selectedCourtSlot}
            onEndpointDrop={applySwap}
            onCourtSlotTap={handleCourtSlotTap}
            onOpenPlayerMenu={openPlayerMenu}
            onCancelSelection={() => setSelection(null)}
          />
        </div>

        {/* Player pool — auto col 1 at md:, explicit col 1 at lg: */}
        <div
          className="md:h-[calc(100vh-3.5rem)] md:sticky md:top-14 lg:col-start-1 lg:row-start-1"
        >
          <PlayerPoolColumn
            queue={queue}
            bench={bench}
            gamesPlayedMap={gamesPlayedMap}
            slottedPlayerIds={slottedPlayerIds}
            peerMedianEnteredAt={queueMedianEnteredAt}
            onQueueRemove={handleQueueRemove}
            onMoveToBench={handleMoveToBench}
            onBenchReturnToQueue={handleBenchReturnToQueue}
            onBenchRemove={handleBenchRemove}
            onPlayerDragStart={() => {}}
            onPlayerDragEnd={() => {}}
            onAddPlayers={handleAddPlayers}
            existingPlayerNames={existingPlayerNames}
            selectedPlayerId={selectedPoolPlayerId}
            onSelectPlayer={handlePoolRowActivate}
            armedCourtSlot={selectedCourtSlot}
            onEndpointDrop={applySwap}
            onEditPlayer={openEditPlayer}
            onOpenPlayerMenu={openPlayerMenu}
          />
        </div>

        {/* Matchup column — auto col 2 at md:, explicit col 2 at lg: */}
        <div
          className="md:h-[calc(100vh-3.5rem)] md:sticky md:top-14 lg:col-start-2 lg:row-start-1"
        >
          <MatchupColumn
            planningCards={planningCards}
            courts={courts}
            draggingCardId={draggingCardId}
            onCardDismiss={handleCardDismiss}
            onCardMatchTypeChange={handleCardMatchTypeChange}
            onCardAssign={handleCardAssign}
            onCardDragStart={setDraggingCardId}
            onCardDragEnd={() => setDraggingCardId(null)}
            onRemovePlayerFromCard={handleRemovePlayerFromCard}
            onOpenPlayerMenu={openPlayerMenu}
            onAddCard={handleAddCard}
            onSuggestCard={handleSuggestCard}
            onResuggestCard={handleResuggestCard}
            justSuggestedCardIds={justSuggestedCardIds}
            selectedPlayer={selectedPoolPlayer}
            selectedChip={selectedChip}
            waitingSince={waitingSince}
            gamesPlayed={gamesPlayedMap}
            peerMedianEnteredAt={queueMedianEnteredAt}
            onSlotTap={handleSlotTap}
            onEndpointDrop={applySwap}
            onCancelChipSelection={() => setSelection(null)}
          />
        </div>
      </div>

      <PlayerMenu
        point={playerMenu?.point ?? null}
        title={playerMenuTitle}
        items={playerMenuItems}
        onClose={() => setPlayerMenu(null)}
      />

      <PlayerModal
        isOpen={isEditOpen}
        editingPlayer={editingLocation ? playerOf(editingLocation) : null}
        onClose={closeEditPlayer}
        onSave={handleEditSave}
        // Only queue and bench players can be removed from here. A player on a
        // court has to finish, be voided, or be swapped out first.
        onRemove={
          editingLocation && (editingLocation.where === "queue" || editingLocation.where === "bench")
            ? () => editingPlayerId && removeFromSession(editingPlayerId)
            : undefined
        }
      />

      <ToastViewport toast={toast} onDismissAndUndo={dismissAndUndo} />
    </>
  );
}
