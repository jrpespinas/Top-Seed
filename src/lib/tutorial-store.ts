"use client";

import { useCallback, useEffect, useState } from "react";
import type { Court, PlanningCard, QueueEntry, BenchEntry, MatchRecord } from "@/types";

const STORAGE_KEY = "top-seed:tutorial";

export type TutorialMode = "auto" | "manual";

export interface TutorialLiveState {
  hasSession: boolean;
  queue: QueueEntry[];
  bench: BenchEntry[];
  planningCards: PlanningCard[];
  courts: Court[];
  matches: MatchRecord[];
  /**
   * Genuine relocate/swap actions performed, not a placed-player count.
   * `placed >= 2` looked like the right gate for the Relocate step but isn't
   * — Suggest can place 4 players in one click, satisfying it before the
   * organizer ever relocates anyone, letting the step advance unearned. This
   * only increments on a real relocate/swap (see DashboardClient).
   */
  relocateEventCount: number;
}

export interface TutorialStepDef {
  id: string;
  /** Matches a data-tutorial-target attribute value in the live DOM. */
  target: string;
  title: string;
  body: string;
  /**
   * Auto-advances once true. Steps without a gate (substitution) only move
   * on via explicit acknowledgment — forcing a real substitution isn't
   * always possible (needs a spare queued player) or wanted at that exact
   * moment, unlike the other steps which are near-immediate, low-cost
   * actions the organizer is about to take anyway.
   */
  gate?: (state: TutorialLiveState) => boolean;
}

export interface TutorialDef {
  id: string;
  name: string;
  steps: TutorialStepDef[];
}

function countPlacedPlayers(cards: PlanningCard[]): number {
  let total = 0;
  for (const card of cards) {
    if (!card.suggestion) continue;
    total += [...card.suggestion.sideA, ...card.suggestion.sideB].filter(Boolean).length;
  }
  return total;
}

export const TUTORIALS: TutorialDef[] = [
  {
    id: "getting-started",
    name: "Getting Started",
    steps: [
      {
        id: "start-session",
        target: "start-session-button",
        title: "Start your first session",
        body: "Everything in Top Seed — the queue, matchups, and courts — lives inside a session. Start one to begin.",
        gate: (s) => s.hasSession,
      },
      {
        id: "add-players",
        target: "add-players-button",
        title: "Add your players",
        body: "Add everyone checking in today. They'll land in the queue, ready to be matched.",
        gate: (s) => s.queue.length + s.bench.length > 0,
      },
    ],
  },
  {
    id: "building-a-matchup",
    name: "Building a Matchup",
    steps: [
      {
        id: "build-matchup",
        target: "suggest-button",
        title: "Build a matchup",
        body: "Tap Suggest to auto-fill a card with a balanced matchup from the queue — or drag a queued player onto any open slot yourself.",
        gate: (s) => countPlacedPlayers(s.planningCards) >= 1,
      },
    ],
  },
  // Courts precedes Swapping deliberately — Substitute's target (a live
  // court's player row) doesn't exist until a matchup has been assigned to a
  // court, which Swapping's own chapter never teaches. Auto mode walks
  // TUTORIALS in order, so if Swapping ran first, a strict first-run path
  // could reach Substitute (an acknowledge-only step — no gate, only
  // dismissible once its target renders) with no live match anywhere yet,
  // stalling the chain before it ever reaches Courts — the two most
  // operationally important lessons here. This way, by the time Swapping
  // starts, "assign to court" has already run at least once, so Substitute's
  // target is only ever a matter of *when* the next match starts, not *if*
  // the organizer was ever taught how to start one.
  {
    id: "courts",
    name: "Courts",
    steps: [
      {
        id: "assign-to-court",
        target: "assign-to-court-button",
        title: "Send it to a court",
        body: "Once a matchup is full, assign it to an open court to start the match.",
        gate: (s) => s.courts.some((c) => c.status === "IN_USE"),
      },
      {
        id: "fifo-return",
        target: "queue-list",
        title: "Players return in order",
        body: "When a match ends or is voided, everyone goes back to the queue in the order they originally checked in — nobody loses their place.",
        gate: (s) => s.matches.length > 0,
      },
    ],
  },
  {
    id: "swapping",
    name: "Swapping",
    steps: [
      {
        id: "relocate",
        target: "placed-chip",
        title: "Move players around",
        body: "Drag or tap a placed player to move them to a different slot — even a different card. Drop them on someone else to swap positions instead.",
        gate: (s) => s.relocateEventCount >= 1,
      },
      {
        id: "substitute",
        target: "court-player-row",
        title: "Swap someone mid-match",
        body: "The same drag works here — pull a player from the queue or another matchup onto a live match to sub them in. It works in reverse too: drag someone off a court to trade them with any other player, no need to void the game.",
      },
    ],
  },
];

export function findTutorial(id: string): TutorialDef | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

interface ActiveTutorial {
  tutorialId: string;
  stepIndex: number;
  mode: TutorialMode;
}

interface StoredProgress {
  completedTutorialIds: string[];
  active: ActiveTutorial | null;
}

const DEFAULT_PROGRESS: StoredProgress = { completedTutorialIds: [], active: null };

function readProgress(): StoredProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    return { ...DEFAULT_PROGRESS, ...(JSON.parse(raw) as Partial<StoredProgress>) };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function writeProgress(progress: StoredProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable — tutorial state just won't persist this session.
  }
}

export interface ActiveStepInfo {
  tutorial: TutorialDef;
  step: TutorialStepDef;
  stepIndex: number;
  mode: TutorialMode;
}

export function getActiveStepInfo(progress: {
  active: ActiveTutorial | null;
}): ActiveStepInfo | null {
  if (!progress.active) return null;
  const tutorial = findTutorial(progress.active.tutorialId);
  if (!tutorial) return null;
  const step = tutorial.steps[progress.active.stepIndex];
  if (!step) return null;
  return { tutorial, step, stepIndex: progress.active.stepIndex, mode: progress.active.mode };
}

/**
 * Moves past the current step — to the next step in the same tutorial, or
 * (in "auto" mode only) cascades into the next not-yet-completed tutorial in
 * TUTORIALS order. Manual replay mode stops at the end of its own tutorial
 * rather than cascading, since replay is a deliberate, scoped lookup.
 */
function advanceStep(progress: StoredProgress): StoredProgress {
  if (!progress.active) return progress;
  const tutorial = findTutorial(progress.active.tutorialId);
  if (!tutorial) return { ...progress, active: null };

  const nextIndex = progress.active.stepIndex + 1;
  if (nextIndex < tutorial.steps.length) {
    return { ...progress, active: { ...progress.active, stepIndex: nextIndex } };
  }

  const completedTutorialIds = progress.completedTutorialIds.includes(tutorial.id)
    ? progress.completedTutorialIds
    : [...progress.completedTutorialIds, tutorial.id];

  if (progress.active.mode === "auto") {
    const tutorialIndex = TUTORIALS.findIndex((t) => t.id === tutorial.id);
    const next = TUTORIALS[tutorialIndex + 1];
    if (next && !completedTutorialIds.includes(next.id)) {
      return { completedTutorialIds, active: { tutorialId: next.id, stepIndex: 0, mode: "auto" } };
    }
  }
  return { completedTutorialIds, active: null };
}

function skipTutorial(progress: StoredProgress): StoredProgress {
  if (!progress.active) return progress;
  const completedTutorialIds = progress.completedTutorialIds.includes(progress.active.tutorialId)
    ? progress.completedTutorialIds
    : [...progress.completedTutorialIds, progress.active.tutorialId];
  return { completedTutorialIds, active: null };
}

function startTutorial(progress: StoredProgress, tutorialId: string, mode: TutorialMode): StoredProgress {
  if (!findTutorial(tutorialId)) return progress;
  return { ...progress, active: { tutorialId, stepIndex: 0, mode } };
}

/** Kicks off the very first tutorial, but only for a browser that's never touched any tutorial before. */
function maybeAutoStart(progress: StoredProgress): StoredProgress {
  if (progress.active || progress.completedTutorialIds.length > 0) return progress;
  const first = TUTORIALS[0];
  return { ...progress, active: { tutorialId: first.id, stepIndex: 0, mode: "auto" } };
}

/** Manual replay only — gated auto-advance has no notion of stepping backward. */
function goBack(progress: StoredProgress): StoredProgress {
  if (!progress.active || progress.active.stepIndex === 0) return progress;
  return { ...progress, active: { ...progress.active, stepIndex: progress.active.stepIndex - 1 } };
}

/**
 * Owner hook for tutorial progress. Deliberately simpler than session-store's
 * owner-hook pattern (no cross-tab `storage` listener) — tutorial progress
 * isn't live shared state the way the queue/courts are; a stale read in a
 * second tab self-corrects the next time that tab mounts this hook.
 */
export function useTutorialProgress() {
  const [progress, setProgressState] = useState<StoredProgress>(DEFAULT_PROGRESS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgressState(readProgress());
    setHydrated(true);
  }, []);

  const commit = useCallback((next: StoredProgress) => {
    setProgressState(next);
    writeProgress(next);
  }, []);

  const checkAndAdvance = useCallback(
    (liveState: TutorialLiveState) => {
      setProgressState((prev) => {
        const info = getActiveStepInfo(prev);
        if (!info?.step.gate || !info.step.gate(liveState)) return prev;
        const next = advanceStep(prev);
        writeProgress(next);
        return next;
      });
    },
    []
  );

  const runAutoStart = useCallback(() => {
    setProgressState((prev) => {
      const next = maybeAutoStart(prev);
      if (next !== prev) writeProgress(next);
      return next;
    });
  }, []);

  const dismissStep = useCallback(() => commit(advanceStep(progress)), [commit, progress]);
  const skipStep = useCallback(() => commit(advanceStep(progress)), [commit, progress]);
  const skipActiveTutorial = useCallback(() => commit(skipTutorial(progress)), [commit, progress]);
  const goBackStep = useCallback(() => commit(goBack(progress)), [commit, progress]);
  const start = useCallback(
    (tutorialId: string, mode: TutorialMode) => commit(startTutorial(progress, tutorialId, mode)),
    [commit, progress]
  );

  return {
    hydrated,
    activeStep: getActiveStepInfo(progress),
    checkAndAdvance,
    runAutoStart,
    dismissStep,
    skipStep,
    skipActiveTutorial,
    goBackStep,
    startTutorial: start,
  };
}
