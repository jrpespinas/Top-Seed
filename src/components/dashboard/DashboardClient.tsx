"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { ActiveMatch, Court, QueueEntry, PlanningCard, MatchType, MatchResult, MatchRecord, Player } from "@/types";
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
import { suggestMatchup } from "@/lib/smart-matchup";
import { useToast, ToastViewport } from "@/components/ui/Toast";

function sideNames(players: Player[]): string {
  return players.map((p) => p.name).join("/");
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
}

export function DashboardClient({ sessionId }: Props) {
  const [courts, setCourts] = useSessionCourts([]);
  const [queue, setQueue] = useSessionQueue([]);
  const [planningCards, setPlanningCards] = useSessionPlanningCards(buildDefaultPlanningCards());
  const [bench, setBench] = useSessionBench([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [justSuggestedCardId, setJustSuggestedCardId] = useState<string | null>(null);
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
  const triggerSuggestPulse = useCallback((cardId: string) => {
    if (justSuggestedTimerRef.current) clearTimeout(justSuggestedTimerRef.current);
    setJustSuggestedCardId(cardId);
    justSuggestedTimerRef.current = setTimeout(() => setJustSuggestedCardId(null), 2200);
  }, []);
  const matches = useMatchLog();
  const [skipCounts, setSkipCounts] = useSmartMatchupSkipCounts();
  const sessionMatches = useMemo(
    () => matches.filter((m) => m.sessionId === sessionId),
    [matches, sessionId]
  );

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
    setSelectedPlayer((prev) => (prev?.id === player.id ? null : player));
  }, []);

  const handleQueueRemove = useCallback((id: string) => {
    setQueue((prev) =>
      prev.filter((e) => e.id !== id).map((e, i) => ({ ...e, position: i + 1 }))
    );
  }, [setQueue]);

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

    setPlanningCards((prev) =>
      prev.map((card) => {
        if (!card.suggestion) return card;
        const sideA = card.suggestion.sideA.map((p) => (p?.id === player.id ? null : p));
        const sideB = card.suggestion.sideB.map((p) => (p?.id === player.id ? null : p));
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
      })
    );

    setBench((prev) => [
      ...prev,
      { id: `b-${Date.now()}`, player, sessionJoinedAt },
    ]);

    showToast("Moved to bench");
  }, [queue, showToast, setQueue, setBench, setPlanningCards]);

  const handleBenchRemove = useCallback((id: string) => {
    setBench((prev) => prev.filter((e) => e.id !== id));
  }, [setBench]);

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

  const handleCardSwap = useCallback(
    (
      cardId: string,
      from: { side: "A" | "B"; index: number },
      to: { side: "A" | "B"; index: number }
    ) => {
      setPlanningCards((prev) =>
        prev.map((c) => {
          if (c.id !== cardId || !c.suggestion) return c;
          const sideA = [...c.suggestion.sideA];
          const sideB = [...c.suggestion.sideB];
          const fromPlayer = from.side === "A" ? sideA[from.index] : sideB[from.index];
          const toPlayer = to.side === "A" ? sideA[to.index] : sideB[to.index];
          if (!fromPlayer) return c;
          if (from.side === "A") sideA[from.index] = toPlayer ?? null;
          else sideB[from.index] = toPlayer ?? null;
          if (to.side === "A") sideA[to.index] = fromPlayer;
          else sideB[to.index] = fromPlayer;
          return {
            ...c,
            state: "ready" as const,
            suggestion: { ...c.suggestion, sideA, sideB },
          };
        })
      );
    },
    [setPlanningCards]
  );

  const handlePlayerDropOnCard = useCallback(
    (cardId: string, player: Player) => {
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

          let filled = false;
          for (let i = 0; i < max && !filled; i++) {
            if (!sideA[i]) { sideA[i] = player; filled = true; }
          }
          if (!filled) {
            for (let i = 0; i < max && !filled; i++) {
              if (!sideB[i]) { sideB[i] = player; filled = true; }
            }
          }
          if (!filled) return card;

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
    (matchType: MatchType, excludedPlayerIds: string[]) => {
      const result = suggestMatchup({
        queue,
        matches: sessionMatches,
        matchType,
        excludedPlayerIds,
        skipCounts,
      });
      setSkipCounts(result.updatedSkipCounts);
      return result.suggestion;
    },
    [queue, sessionMatches, skipCounts, setSkipCounts]
  );

  const handleSuggestCard = useCallback(() => {
    // Fills the topmost empty card if one exists — an empty card has no
    // suggestion, so it never contributes to slottedPlayerIds and needs no
    // self-exclusion handling (unlike handleResuggestCard below). Only adds a
    // new card when every existing one already has players placed.
    const availableCard = planningCards.find((c) => c.state === "empty");
    const matchType: MatchType = availableCard?.matchType ?? "DOUBLES";
    const suggestion = runSmartSuggest(matchType, Array.from(slottedPlayerIds));

    if (availableCard) {
      setPlanningCards((prev) =>
        prev.map((c) =>
          c.id === availableCard.id
            ? { ...c, suggestion, state: suggestion ? ("ready" as const) : ("empty" as const) }
            : c
        )
      );
      triggerSuggestPulse(availableCard.id);
      return;
    }

    const newCardId = `pc-${Date.now()}`;
    setPlanningCards((prev) => [
      ...prev,
      {
        id: newCardId,
        matchType,
        state: suggestion ? ("ready" as const) : ("empty" as const),
        suggestion,
      },
    ]);
    triggerSuggestPulse(newCardId);
  }, [planningCards, runSmartSuggest, slottedPlayerIds, setPlanningCards, triggerSuggestPulse]);

  const handleResuggestCard = useCallback(
    (cardId: string) => {
      const card = planningCards.find((c) => c.id === cardId);
      if (!card) return;

      // A card resuggesting itself shouldn't exclude its own current players.
      const claimedByOtherCards = new Set(slottedPlayerIds);
      if (card.suggestion) {
        for (const p of [...card.suggestion.sideA, ...card.suggestion.sideB]) {
          if (p) claimedByOtherCards.delete(p.id);
        }
      }

      const suggestion = runSmartSuggest(card.matchType, Array.from(claimedByOtherCards));
      setPlanningCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, suggestion, state: suggestion ? ("ready" as const) : ("empty" as const) }
            : c
        )
      );
      triggerSuggestPulse(cardId);
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
            onCardSwap={handleCardSwap}
            onCardAssign={handleCardAssign}
            onCardDragStart={setDraggingCardId}
            onCardDragEnd={() => setDraggingCardId(null)}
            onPlayerDropOnCard={handlePlayerDropOnCard}
            onRemovePlayerFromCard={handleRemovePlayerFromCard}
            onAddCard={handleAddCard}
            onSuggestCard={handleSuggestCard}
            onResuggestCard={handleResuggestCard}
            justSuggestedCardId={justSuggestedCardId}
            selectedPlayer={selectedPlayer}
          />
        </div>
      </div>

      <ToastViewport toast={toast} onDismissAndUndo={dismissAndUndo} />
    </>
  );
}
