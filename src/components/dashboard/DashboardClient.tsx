"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type {
  ActiveMatch,
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
import { addMatchRecord, removeMatchRecord, useGamesPlayedMap, useMatchLog } from "@/lib/match-log-store";
import {
  useSessionQueue,
  useSessionBench,
  useSessionCourts,
  useSessionPlanningCards,
  useSmartMatchupSkipCounts,
  appendSortedByCheckIn,
  buildDefaultPlanningCards,
} from "@/lib/session-store";
import { suggestMatchup, type LockedPlacement } from "@/lib/smart-matchup";
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

export function DashboardClient({ sessionId, onTutorialCheck }: Props) {
  const [courts, setCourts] = useSessionCourts([]);
  const [queue, setQueue] = useSessionQueue([]);
  const [planningCards, setPlanningCards] = useSessionPlanningCards(buildDefaultPlanningCards());
  const [bench, setBench] = useSessionBench([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  // Chip selection lives here, not inside PlanningCard, so a chip selected in
  // one card can be relocated or swapped into a slot on a different card —
  // the same reason selectedPlayer (queue tap-to-place) already lives here.
  const [selectedChip, setSelectedChip] = useState<SlotAddress | null>(null);
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

  // Tap-to-place: touch-friendly alternative to dragging a player onto a card.
  const handleSelectPlayer = useCallback((player: Player) => {
    setSelectedChip(null);
    setSelectedPlayer((prev) => (prev?.id === player.id ? null : player));
  }, []);

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

  // Moves an already-placed player from one slot to another — same card or a
  // different one. An empty target relocates them; an occupied target swaps
  // the two. Both cards' arrays are mutated in one state update so there's
  // never a transient frame where the mover exists in neither (or both).
  const handleRelocatePlacedPlayer = useCallback(
    (from: SlotAddress, to: SlotAddress) => {
      if (from.cardId === to.cardId && from.side === to.side && from.index === to.index) {
        setSelectedChip(null);
        return;
      }

      // Validated against the current snapshot, not the updater's `prev`
      // below — purely to decide whether this counts as a genuine relocate
      // for the tutorial engine. A state setter can't safely run inside a
      // setPlanningCards updater (React may invoke it more than once to
      // verify purity), so this mirrors — and must stay in sync with — the
      // same guard conditions the updater checks just below.
      const fromCardSnapshot = planningCards.find((c) => c.id === from.cardId);
      const toCardSnapshot = planningCards.find((c) => c.id === to.cardId);
      const fromMaxSnapshot = fromCardSnapshot?.matchType === "DOUBLES" ? 2 : 1;
      const toMaxSnapshot = toCardSnapshot?.matchType === "DOUBLES" ? 2 : 1;
      const movingPlayerSnapshot =
        fromCardSnapshot?.suggestion && from.index < fromMaxSnapshot
          ? from.side === "A"
            ? fromCardSnapshot.suggestion.sideA[from.index]
            : fromCardSnapshot.suggestion.sideB[from.index]
          : null;
      const willSucceed =
        !!fromCardSnapshot?.suggestion &&
        !!toCardSnapshot &&
        from.index < fromMaxSnapshot &&
        to.index < toMaxSnapshot &&
        !!movingPlayerSnapshot;
      if (willSucceed) setRelocateEventCount((c) => c + 1);

      setPlanningCards((prev) => {
        const fromCard = prev.find((c) => c.id === from.cardId);
        const toCard = prev.find((c) => c.id === to.cardId);
        if (!fromCard?.suggestion || !toCard) return prev;
        const fromMax = fromCard.matchType === "DOUBLES" ? 2 : 1;
        const toMax = toCard.matchType === "DOUBLES" ? 2 : 1;
        if (from.index >= fromMax || to.index >= toMax) return prev;
        const movingPlayer =
          from.side === "A" ? fromCard.suggestion.sideA[from.index] : fromCard.suggestion.sideB[from.index];
        if (!movingPlayer) return prev;

        if (from.cardId === to.cardId) {
          const sideA = [...fromCard.suggestion.sideA];
          const sideB = [...fromCard.suggestion.sideB];
          const toPlayer = to.side === "A" ? sideA[to.index] : sideB[to.index];
          if (from.side === "A") sideA[from.index] = toPlayer ?? null;
          else sideB[from.index] = toPlayer ?? null;
          if (to.side === "A") sideA[to.index] = movingPlayer;
          else sideB[to.index] = movingPlayer;
          const isFull = sideA.slice(0, fromMax).every(Boolean) && sideB.slice(0, fromMax).every(Boolean);
          return prev.map((c) =>
            c.id === from.cardId
              ? {
                  ...c,
                  state: isFull ? ("ready" as const) : ("proposed" as const),
                  suggestion: { ...c.suggestion!, sideA, sideB },
                }
              : c
          );
        }

        const fromSideA = [...fromCard.suggestion.sideA];
        const fromSideB = [...fromCard.suggestion.sideB];
        const toSideA = toCard.suggestion ? [...toCard.suggestion.sideA] : Array(toMax).fill(null);
        const toSideB = toCard.suggestion ? [...toCard.suggestion.sideB] : Array(toMax).fill(null);
        const displacedPlayer = to.side === "A" ? toSideA[to.index] : toSideB[to.index];

        if (from.side === "A") fromSideA[from.index] = displacedPlayer;
        else fromSideB[from.index] = displacedPlayer;
        if (to.side === "A") toSideA[to.index] = movingPlayer;
        else toSideB[to.index] = movingPlayer;

        const fromHasAny = [...fromSideA, ...fromSideB].some(Boolean);
        const fromFull = fromSideA.slice(0, fromMax).every(Boolean) && fromSideB.slice(0, fromMax).every(Boolean);
        const toFull = toSideA.slice(0, toMax).every(Boolean) && toSideB.slice(0, toMax).every(Boolean);

        return prev.map((c) => {
          if (c.id === from.cardId) {
            return {
              ...c,
              state: fromFull ? ("ready" as const) : fromHasAny ? ("proposed" as const) : ("empty" as const),
              suggestion: fromHasAny ? { ...c.suggestion!, sideA: fromSideA, sideB: fromSideB } : null,
            };
          }
          if (c.id === to.cardId) {
            return {
              ...c,
              state: toFull ? ("ready" as const) : ("proposed" as const),
              suggestion: {
                pairsExhausted: c.suggestion?.pairsExhausted ?? false,
                sideA: toSideA,
                sideB: toSideB,
              },
            };
          }
          return c;
        });
      });
      setSelectedChip(null);
    },
    [planningCards, setPlanningCards]
  );

  const handlePlayerDropOnCard = useCallback(
    (cardId: string, player: Player, target: { side: "A" | "B"; index: number }) => {
      const isDuplicate = planningCards.some(
        (card) =>
          card.suggestion &&
          [...card.suggestion.sideA, ...card.suggestion.sideB].some((p) => p?.id === player.id)
      );
      if (isDuplicate) {
        showToast(`${player.name} is already in a card`);
        return;
      }

      // Promote bench player to the queue, sorted by check-in time, on drop
      const benchEntry = bench.find((e) => e.player.id === player.id);
      if (benchEntry) {
        setBench((prev) => prev.filter((e) => e.player.id !== player.id));
        setQueue((prev) =>
          appendSortedByCheckIn(prev, [
            {
              id: `q-${Date.now()}`,
              player,
              position: 0,
              isInMatch: false,
              sessionJoinedAt: benchEntry.sessionJoinedAt,
              enteredQueueAt: new Date().toISOString(),
            },
          ])
        );
      }

      setPlanningCards((prev) =>
        prev.map((card) => {
          if (card.id !== cardId) return card;
          const max = card.matchType === "DOUBLES" ? 2 : 1;
          const sideA: (Player | null)[] = card.suggestion
            ? [...card.suggestion.sideA]
            : Array(max).fill(null);
          const sideB: (Player | null)[] = card.suggestion
            ? [...card.suggestion.sideB]
            : Array(max).fill(null);

          const targetSide = target.side === "A" ? sideA : sideB;
          if (target.index < 0 || target.index >= max || targetSide[target.index]) return card;
          targetSide[target.index] = player;

          const allFull =
            sideA.slice(0, max).every(Boolean) && sideB.slice(0, max).every(Boolean);
          return {
            ...card,
            state: allFull ? ("ready" as const) : ("proposed" as const),
            suggestion: { sideA, sideB, pairsExhausted: false },
          };
        })
      );
      setSelectedPlayer(null);
    },
    [planningCards, showToast, bench, setBench, setQueue, setPlanningCards]
  );

  // Single decision point for every slot tap (empty or filled, any card):
  // resolves against whichever selection — a queue player or a placed chip —
  // is currently active, so PlanningCard itself doesn't need to know the
  // difference between "start a selection" and "act on one".
  const handleSlotTap = useCallback(
    (cardId: string, side: "A" | "B", index: number) => {
      const card = planningCards.find((c) => c.id === cardId);
      const occupant = card?.suggestion
        ? side === "A"
          ? card.suggestion.sideA[index]
          : card.suggestion.sideB[index]
        : null;

      if (occupant) {
        if (
          selectedChip &&
          selectedChip.cardId === cardId &&
          selectedChip.side === side &&
          selectedChip.index === index
        ) {
          setSelectedChip(null);
          return;
        }
        if (selectedChip) {
          handleRelocatePlacedPlayer(selectedChip, { cardId, side, index });
          return;
        }
        setSelectedPlayer(null);
        setSelectedChip({ cardId, side, index });
        return;
      }

      if (selectedPlayer) {
        handlePlayerDropOnCard(cardId, selectedPlayer, { side, index });
        return;
      }
      if (selectedChip) {
        handleRelocatePlacedPlayer(selectedChip, { cardId, side, index });
      }
    },
    [planningCards, selectedChip, selectedPlayer, handleRelocatePlacedPlayer, handlePlayerDropOnCard]
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
      });
      setSkipCounts(result.updatedSkipCounts);
      return result.suggestion;
    },
    [queue, sessionMatches, skipCounts, setSkipCounts, gamesPlayedMap]
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

  // Substitutes a player into an already-live court match, from the queue or
  // bench. The match's identity is untouched (same startedAt, same elapsed
  // clock) — this only mutates the roster, so gamesPlayed crediting at
  // End/Void time (which reads the ActiveMatch's current sideA/sideB) falls
  // out for free: whoever's in the lineup then gets credit, the player who
  // left early doesn't. The outgoing player goes to bench, not the queue —
  // leaving a live match means resting, not re-queueing for another game.
  const handleSubstituteFromQueue = useCallback(
    (courtId: string, side: "A" | "B", index: number, player: Player) => {
      const court = courts.find((c) => c.id === courtId);
      if (!court?.activeMatch) return;
      const { activeMatch } = court;
      const outgoing = side === "A" ? activeMatch.sideA[index] : activeMatch.sideB[index];
      if (!outgoing || outgoing.id === player.id) return;
      const alreadyInMatch = [...activeMatch.sideA, ...activeMatch.sideB].some((p) => p.id === player.id);
      if (alreadyInMatch) {
        showToast(`${player.name} is already in this match`);
        return;
      }
      // A queue row can represent a "matched" player already placed in a
      // planning card (placement doesn't remove them from the queue) —
      // substituting them here without checking would double-book them.
      // Mirrors handlePlayerDropOnCard's own cross-card duplicate guard.
      const alreadyInCard = planningCards.some(
        (card) =>
          card.suggestion &&
          [...card.suggestion.sideA, ...card.suggestion.sideB].some((p) => p?.id === player.id)
      );
      if (alreadyInCard) {
        showToast(`${player.name} is already in a matchup card`);
        return;
      }

      const originalQueueEntry = queue.find((e) => e.player.id === player.id) ?? null;
      const originalBenchEntry = bench.find((e) => e.player.id === player.id) ?? null;
      const incomingSessionJoinedAt =
        originalQueueEntry?.sessionJoinedAt ?? originalBenchEntry?.sessionJoinedAt ?? new Date().toISOString();

      if (originalQueueEntry) {
        setQueue((prev) =>
          prev.filter((e) => e.id !== originalQueueEntry.id).map((e, i) => ({ ...e, position: i + 1 }))
        );
      }
      setBench((prev) => {
        const withoutIncoming = originalBenchEntry ? prev.filter((e) => e.id !== originalBenchEntry.id) : prev;
        return [
          ...withoutIncoming,
          {
            id: `b-${Date.now()}`,
            player: outgoing,
            sessionJoinedAt: activeMatch.sessionJoinedAtByPlayer[outgoing.id] ?? new Date().toISOString(),
          },
        ];
      });
      setCourts((prev) =>
        prev.map((c) => {
          if (c.id !== courtId || !c.activeMatch) return c;
          const sideA = [...c.activeMatch.sideA];
          const sideB = [...c.activeMatch.sideB];
          if (side === "A") sideA[index] = player;
          else sideB[index] = player;
          return {
            ...c,
            activeMatch: {
              ...c.activeMatch,
              sideA,
              sideB,
              sessionJoinedAtByPlayer: {
                ...c.activeMatch.sessionJoinedAtByPlayer,
                [player.id]: incomingSessionJoinedAt,
              },
            },
          };
        })
      );

      showToast(
        `${player.name} subbed in for ${outgoing.name}`,
        () => {
          setCourts((prev) => prev.map((c) => (c.id === courtId ? court : c)));
          setBench((prev) => {
            const withoutOutgoing = prev.filter((e) => e.player.id !== outgoing.id);
            return originalBenchEntry ? [...withoutOutgoing, originalBenchEntry] : withoutOutgoing;
          });
          if (originalQueueEntry) {
            setQueue((prev) =>
              appendSortedByCheckIn(prev, [{ ...originalQueueEntry, enteredQueueAt: new Date().toISOString() }])
            );
          }
        },
        "Undo substitution"
      );
      setSelectedPlayer(null);
      setSelectedChip(null);
    },
    [courts, queue, bench, planningCards, showToast, setQueue, setBench, setCourts]
  );

  // Same substitution, sourced from a player already placed in a planning
  // card instead of the live queue. A player sitting in a planning-card slot
  // still has a real QueueEntry underneath it (placement doesn't remove them
  // from the queue — only court assignment does), so this has to clear both
  // the card slot and the queue entry, and restore both on undo.
  const handleSubstituteFromChip = useCallback(
    (courtId: string, side: "A" | "B", index: number, from: SlotAddress) => {
      const court = courts.find((c) => c.id === courtId);
      const fromCard = planningCards.find((c) => c.id === from.cardId);
      if (!court?.activeMatch || !fromCard?.suggestion) return;
      const { activeMatch } = court;
      const outgoing = side === "A" ? activeMatch.sideA[index] : activeMatch.sideB[index];
      const incoming =
        from.side === "A" ? fromCard.suggestion.sideA[from.index] : fromCard.suggestion.sideB[from.index];
      if (!outgoing || !incoming) return;
      if (outgoing.id === incoming.id) return;
      const alreadyInMatch = [...activeMatch.sideA, ...activeMatch.sideB].some((p) => p.id === incoming.id);
      if (alreadyInMatch) {
        showToast(`${incoming.name} is already in this match`);
        return;
      }

      const incomingQueueEntry = queue.find((e) => e.player.id === incoming.id) ?? null;
      const incomingSessionJoinedAt = incomingQueueEntry?.sessionJoinedAt ?? new Date().toISOString();

      const fromMax = fromCard.matchType === "DOUBLES" ? 2 : 1;
      const fromSideA = [...fromCard.suggestion.sideA];
      const fromSideB = [...fromCard.suggestion.sideB];
      if (from.side === "A") fromSideA[from.index] = null;
      else fromSideB[from.index] = null;
      const fromHasAny = [...fromSideA, ...fromSideB].some(Boolean);
      const fromFull = fromSideA.slice(0, fromMax).every(Boolean) && fromSideB.slice(0, fromMax).every(Boolean);

      setPlanningCards((prev) =>
        prev.map((c) =>
          c.id === from.cardId
            ? {
                ...c,
                state: fromFull ? ("ready" as const) : fromHasAny ? ("proposed" as const) : ("empty" as const),
                suggestion: fromHasAny ? { ...c.suggestion!, sideA: fromSideA, sideB: fromSideB } : null,
              }
            : c
        )
      );
      if (incomingQueueEntry) {
        setQueue((prev) =>
          prev.filter((e) => e.id !== incomingQueueEntry.id).map((e, i) => ({ ...e, position: i + 1 }))
        );
      }
      setBench((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          player: outgoing,
          sessionJoinedAt: activeMatch.sessionJoinedAtByPlayer[outgoing.id] ?? new Date().toISOString(),
        },
      ]);
      setCourts((prev) =>
        prev.map((c) => {
          if (c.id !== courtId || !c.activeMatch) return c;
          const sideA = [...c.activeMatch.sideA];
          const sideB = [...c.activeMatch.sideB];
          if (side === "A") sideA[index] = incoming;
          else sideB[index] = incoming;
          return {
            ...c,
            activeMatch: {
              ...c.activeMatch,
              sideA,
              sideB,
              sessionJoinedAtByPlayer: {
                ...c.activeMatch.sessionJoinedAtByPlayer,
                [incoming.id]: incomingSessionJoinedAt,
              },
            },
          };
        })
      );

      showToast(
        `${incoming.name} subbed in for ${outgoing.name}`,
        () => {
          setCourts((prev) => prev.map((c) => (c.id === courtId ? court : c)));
          setBench((prev) => prev.filter((e) => e.player.id !== outgoing.id));
          setPlanningCards((prev) => prev.map((c) => (c.id === from.cardId ? fromCard : c)));
          if (incomingQueueEntry) {
            setQueue((prev) =>
              appendSortedByCheckIn(prev, [{ ...incomingQueueEntry, enteredQueueAt: new Date().toISOString() }])
            );
          }
        },
        "Undo substitution"
      );
      setSelectedChip(null);
      setSelectedPlayer(null);
    },
    [courts, planningCards, queue, showToast, setPlanningCards, setQueue, setBench, setCourts]
  );

  // Single decision point for tapping a live court match's player slot,
  // mirroring handleSlotTap's role for planning cards — court slots are
  // destination-only (never a selection source; pulling a player out with no
  // replacement is still Void/End's job), so this only ever resolves an
  // already-armed selection.
  const handleCourtSlotTap = useCallback(
    (courtId: string, side: "A" | "B", index: number) => {
      if (selectedPlayer) {
        handleSubstituteFromQueue(courtId, side, index, selectedPlayer);
        return;
      }
      if (selectedChip) {
        handleSubstituteFromChip(courtId, side, index, selectedChip);
      }
    },
    [selectedPlayer, selectedChip, handleSubstituteFromQueue, handleSubstituteFromChip]
  );

  return (
    <>
      {/*
        3-column grid:
        mobile  → single column, Courts shown FIRST (live timers + end/void are the most
                  time-urgent controls courtside), then Players, then Matchups
        tablet  → courts strip full-width row 1 [md:col-span-2], then Players [4fr] | Matchups [3fr] in row 2
        desktop → Players [4fr col-1] | Matchups [3fr col-2] | Courts [3fr col-3] — all in row 1

        The mobile/desktop Courts block is placed FIRST in the DOM so mobile's single-column
        flow shows it first (both visually and in reading/tab order — using DOM order here
        instead of a CSS `order-*` utility keeps visual order and a11y order in sync).
        At md/lg this block relies on explicit lg:col-start-3 placement (or is hidden at md),
        so moving it earlier in the DOM does not affect tablet or desktop layout.
      */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[4fr_3fr] lg:grid-cols-[4fr_3fr_3fr] gap-4 p-4 items-start">
        {/* Courts — mobile (shown first) and desktop (explicit col 3, row 1) */}
        <div className="md:hidden lg:block lg:col-start-3 lg:row-start-1 lg:h-[calc(100vh-3.5rem)] lg:sticky lg:top-14">
          <CourtsSection
            courts={courts}
            cols={1}
            isDragging={draggingCardId !== null}
            onCourtDrop={handleCourtDrop}
            onAdd={handleAddCourt}
            onDelete={handleDeleteCourt}
            onEndMatch={handleEndMatch}
            onVoidMatch={handleVoidMatch}
            selectedPlayer={selectedPlayer}
            selectedChip={selectedChip}
            onSubstituteFromQueue={handleSubstituteFromQueue}
            onSubstituteFromChip={handleSubstituteFromChip}
            onCourtSlotTap={handleCourtSlotTap}
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
            selectedPlayer={selectedPlayer}
            selectedChip={selectedChip}
            onSubstituteFromQueue={handleSubstituteFromQueue}
            onSubstituteFromChip={handleSubstituteFromChip}
            onCourtSlotTap={handleCourtSlotTap}
          />
        </div>

        {/* Player pool — auto col 1 at md:, explicit col 1 at lg: */}
        <div className="md:h-[calc(100vh-3.5rem)] md:sticky md:top-14 lg:col-start-1 lg:row-start-1">
          <PlayerPoolColumn
            queue={queue}
            bench={bench}
            gamesPlayedMap={gamesPlayedMap}
            slottedPlayerIds={slottedPlayerIds}
            onQueueRemove={handleQueueRemove}
            onMoveToBench={handleMoveToBench}
            onBenchReturnToQueue={handleBenchReturnToQueue}
            onBenchRemove={handleBenchRemove}
            onPlayerDragStart={() => {}}
            onPlayerDragEnd={() => {}}
            onAddPlayers={handleAddPlayers}
            existingPlayerNames={existingPlayerNames}
            selectedPlayerId={selectedPlayer?.id ?? null}
            onSelectPlayer={handleSelectPlayer}
            showToast={showToast}
          />
        </div>

        {/* Matchup column — auto col 2 at md:, explicit col 2 at lg: */}
        <div className="md:h-[calc(100vh-3.5rem)] md:sticky md:top-14 lg:col-start-2 lg:row-start-1">
          <MatchupColumn
            planningCards={planningCards}
            courts={courts}
            draggingCardId={draggingCardId}
            onCardDismiss={handleCardDismiss}
            onCardMatchTypeChange={handleCardMatchTypeChange}
            onCardAssign={handleCardAssign}
            onCardDragStart={setDraggingCardId}
            onCardDragEnd={() => setDraggingCardId(null)}
            onPlayerDropOnCard={handlePlayerDropOnCard}
            onRemovePlayerFromCard={handleRemovePlayerFromCard}
            onAddCard={handleAddCard}
            onSuggestCard={handleSuggestCard}
            onResuggestCard={handleResuggestCard}
            justSuggestedCardIds={justSuggestedCardIds}
            selectedPlayer={selectedPlayer}
            selectedChip={selectedChip}
            onSlotTap={handleSlotTap}
            onChipRelocateDrop={handleRelocatePlacedPlayer}
            onCancelChipSelection={() => setSelectedChip(null)}
          />
        </div>
      </div>

      <ToastViewport toast={toast} onDismissAndUndo={dismissAndUndo} />
    </>
  );
}
