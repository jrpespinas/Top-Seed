"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import type { QueueEntry, BenchEntry, Player, SkillLevel, Gender } from "@/types";
import { canDrop, type Endpoint } from "@/lib/roster-swap";
import {
  dragEndpointKind,
  readEndpointPayload,
  writeEndpointPayload,
  type CourtSlotAddress,
} from "./DashboardClient";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { ElapsedTimer } from "@/components/ui/ElapsedTimer";
import { AddPlayersModal, type NewPlayerInput } from "./AddPlayersModal";
import { PlayerModal } from "@/components/players/PlayerModal";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";
import {
  updateQueuePlayer,
  updateBenchPlayer,
  removeQueueEntry,
  removeBenchEntry,
  restoreQueueEntry,
  restoreBenchEntry,
} from "@/lib/session-store";
import {
  ChevronRight,
  GripVertical,
  Clock,
  Coffee,
  X,
  Check,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

type QueueSortKey = "position" | "gamesPlayed" | "waitingTime" | "skillLevel";
type SortDir = "asc" | "desc";

const PANEL_WIDTH = 320; // must match the `sm:w-80` on the panel below

const QUEUE_SORT_KEYS: QueueSortKey[] = ["position", "gamesPlayed", "waitingTime", "skillLevel"];
const QUEUE_SORT_LABELS: Record<QueueSortKey, string> = {
  position: "Queue Order",
  gamesPlayed: "Games Played",
  waitingTime: "Waiting Time",
  skillLevel: "Skill Level",
};
const SKILL_LEVELS: SkillLevel[] = ["ADVANCED", "INTERMEDIATE", "BEGINNER", "CASUAL"];
const SKILL_ORDER: Record<SkillLevel, number> = { ADVANCED: 0, INTERMEDIATE: 1, BEGINNER: 2, CASUAL: 3 };

// Trigger + portaled panel for the queue's sort/filter controls. Modeled on
// SessionSelect's open/position/outside-click/Escape mechanics rather than
// TutorialMenu's — this panel holds several independent, non-closing
// controls (pick a sort key, toggle direction, multi-select level chips),
// not a list of items that each perform one action and close, so it
// deliberately skips role="menu"/menuitem and arrow-key roving focus.
function QueueSortPopover({
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirToggle,
  skillFilter,
  onToggleSkillFilter,
  onClearFilters,
}: {
  sortKey: QueueSortKey;
  sortDir: SortDir;
  onSortKeyChange: (key: QueueSortKey) => void;
  onSortDirToggle: () => void;
  skillFilter: Set<SkillLevel>;
  onToggleSkillFilter: (level: SkillLevel) => void;
  onClearFilters: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => setMounted(true), []);

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) btnRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      close(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(true);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Below `sm:` the panel spans the viewport (minus a small gutter)
      // instead of anchoring to the trigger — a narrow screen has no room
      // for a fixed-width panel to sit fully on-screen.
      if (window.innerWidth < 640) {
        setPos({ top: r.bottom + 6, left: 8, right: 8 });
      } else {
        // Opens rightward from the trigger. Right-anchoring put the panel's
        // 320px directly on top of the player list — the one thing you need to
        // watch while filtering it. Clamped so it still can't leave the
        // viewport on a narrow desktop window.
        const maxLeft = window.innerWidth - PANEL_WIDTH - 8;
        setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, maxLeft)) });
      }
    }
    setOpen((o) => !o);
  }

  const isSorted = sortKey !== "position";
  const hasFilters = skillFilter.size > 0;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Sort and filter queue"
        title="Sort and filter queue"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          "flex-shrink-0 flex items-center justify-center h-[30px] w-[30px] rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border",
          isSorted || hasFilters
            ? "text-primary bg-primary/10 border-primary/30 hover:bg-primary/15"
            : "text-muted border-border/60 hover:text-ink hover:bg-surface-elevated"
        )}
      >
        <ArrowUpDown size={12} strokeWidth={2} aria-hidden />
      </button>
      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="group"
            aria-label="Sort and filter queue"
            className="fixed z-[var(--z-popover)] w-72 sm:w-80 bg-surface border border-border rounded-lg shadow-lg p-3 animate-tutorial-in"
            style={{ top: pos.top, left: pos.left, right: pos.right }}
          >
            <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
              Sort by
            </span>
            <div role="radiogroup" aria-label="Sort queue by" className="flex flex-col gap-0.5 mt-1.5">
              {QUEUE_SORT_KEYS.map((key) => {
                const active = sortKey === key;
                return (
                  <div key={key} className="flex items-center gap-1">
                    <button
                      role="radio"
                      aria-checked={active}
                      onClick={() => onSortKeyChange(key)}
                      className={cn(
                        "flex-1 text-left text-sm px-2 py-1.5 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        active ? "text-ink bg-surface-elevated" : "text-muted hover:text-ink hover:bg-surface-elevated"
                      )}
                    >
                      {QUEUE_SORT_LABELS[key]}
                    </button>
                    {active && key !== "position" && (
                      <button
                        onClick={onSortDirToggle}
                        aria-label={
                          sortDir === "asc"
                            ? "Sort ascending, click for descending"
                            : "Sort descending, click for ascending"
                        }
                        className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        {sortDir === "asc" ? (
                          <ChevronUp size={12} strokeWidth={2.5} aria-hidden />
                        ) : (
                          <ChevronDown size={12} strokeWidth={2.5} aria-hidden />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-border/60 my-2.5" aria-hidden />

            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
                Filter by level
              </span>
              {hasFilters && (
                <button
                  onClick={onClearFilters}
                  className="text-xs text-primary hover:text-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
                >
                  Clear
                </button>
              )}
            </div>
            <div role="group" aria-label="Filter by skill level" className="flex flex-wrap items-center gap-1">
              {SKILL_LEVELS.map((level) => {
                const active = skillFilter.has(level);
                return (
                  <button
                    key={level}
                    onClick={() => onToggleSkillFilter(level)}
                    aria-pressed={active}
                    aria-label={`${active ? "Remove" : "Add"} ${SKILL_LABELS[level]} filter`}
                    title={SKILL_LABELS[level]}
                    className={cn(
                      "h-7 px-2 flex items-center justify-center rounded-sm text-[10px] font-semibold flex-shrink-0",
                      "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      active
                        ? "bg-surface-elevated text-ink border border-border ring-1 ring-primary/50"
                        : "text-muted hover:bg-surface-elevated hover:text-ink"
                    )}
                  >
                    {SKILL_LABELS_SHORT[level]}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

interface Props {
  queue: QueueEntry[];
  bench: BenchEntry[];
  gamesPlayedMap: Map<string, number>;
  slottedPlayerIds: Set<string>;
  onQueueRemove: (id: string) => void;
  onMoveToBench: (id: string) => void;
  onBenchReturnToQueue: (id: string) => void;
  onBenchRemove: (id: string) => void;
  onPlayerDragStart: (playerId: string) => void;
  onPlayerDragEnd: () => void;
  onAddPlayers: (players: NewPlayerInput[]) => void;
  existingPlayerNames: Set<string>;
  selectedPlayerId?: string | null;
  onSelectPlayer: (player: Player) => void;
  // Set while a live-court player is armed — every pool row becomes a legal
  // destination for them, so rows advertise themselves as swap targets.
  armedCourtSlot?: CourtSlotAddress | null;
  onEndpointDrop?: (from: Endpoint, to: Endpoint) => void;
  // Threaded through to DashboardClient's single shared toast instance rather
  // than this column owning its own ToastViewport — two independent toasts
  // would stack at the same fixed bottom-center position.
  showToast: (message: string, onUndo?: () => void, undoLabel?: string) => void;
}

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

// Labelled row actions. Wider than the icon squares they replace, but a text
// target is easier to hit accurately than a 27px glyph, and the label is the
// whole point — these sit on their own line precisely so they can be read.
const ACTION_BTN =
  "inline-flex items-center gap-1 text-[10px] font-medium text-muted hover:text-ink border border-border/60 hover:bg-surface-elevated px-2 py-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border";

function PlayerRow({
  player,
  isInMatch,
  isSelected,
  isSwapTarget,
  onEndpointDrop,
  endpoint,
  gamesPlayed,
  waitingSinceISO,
  onMoveToBench,
  onReturnToQueue,
  onRemove,
  onEdit,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  player: Player;
  isInMatch?: boolean;
  isSelected?: boolean;
  // Visual hint only: a court player is tap-armed, so this row is a legal
  // destination. Drag acceptance is gated on the drag's own origin instead,
  // since dragging never arms a selection.
  isSwapTarget?: boolean;
  onEndpointDrop?: (from: Endpoint, to: Endpoint) => void;
  endpoint: Endpoint;
  gamesPlayed?: number;
  // Queue rows only — how long this player has been in their current queue
  // position (not total session time; see QueueEntry.enteredQueueAt).
  waitingSinceISO?: string;
  onMoveToBench?: () => void;
  onEdit?: () => void;
  onReturnToQueue?: () => void;
  onRemove?: () => void;
  onSelect?: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const displayName = player.name;

  const dimmed = isInMatch;

  return (
    <div
      draggable={!isInMatch}
      onClick={!isInMatch ? onSelect : undefined}
      onDragStart={(e) => {
        writeEndpointPayload(e, endpoint);
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      onDragOver={(e) => {
        // Gated on the *drag's* origin, not on isSwapTarget: that prop reflects
        // a tap-armed selection, and a drag never arms one. Reading it here
        // made court-to-queue work by tap but silently do nothing by drag.
        const kind = dragEndpointKind(e);
        if (kind === null || !canDrop(kind, "pool")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
      }}
      onDrop={(e) => {
        setIsDragOver(false);
        if (!onEndpointDrop) return;
        const from = readEndpointPayload(e);
        if (!from || !canDrop(from.kind, "pool")) return;
        e.preventDefault();
        onEndpointDrop(from, endpoint);
      }}
      className={cn(
        "flex items-start gap-1.5 px-2 py-2 rounded-md border border-border bg-surface-elevated/25 transition-colors group",
        !isInMatch && "hover:bg-surface-elevated/50 hover:border-border/80 active:bg-surface-elevated/70 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        dimmed && "opacity-50",
        isSelected && "bg-primary/10 hover:bg-primary/12 border-primary/40",
        isSwapTarget && !isDragOver && "ring-1 ring-inset ring-primary/25",
        isDragOver && "ring-1 ring-inset ring-primary/60 bg-primary/15"
      )}
    >
      {/* Grip + position */}
      <div className="flex items-center gap-0.5 flex-shrink-0 self-start pt-px">
        {!isInMatch && (
          <GripVertical
            size={10}
            strokeWidth={1.75}
            className="text-muted/60 group-hover:text-muted/80 transition-colors flex-shrink-0"
            aria-hidden
          />
        )}
      </div>

      {/* Three lines: identity, then attributes, then actions. Two lines still
          collided at this column width — the skill badge, status pill and three
          buttons all competed on one line. Giving actions their own row is what
          buys them readable labels and a real tap target. */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Name + how long they've been waiting */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("text-[13px] font-medium truncate leading-none", dimmed ? "text-muted" : "text-ink")}>
            {displayName}
          </span>
          {/* No `size` override: GenderIcon clamps to MIN_LEGIBLE_SIZE (14) —
              below that the Mars/Venus glyph reads as a coloured dot. */}
          {player.gender && <GenderIcon gender={player.gender} />}
          <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <span
              className="text-[10px] font-mono tabular-nums text-muted leading-none"
              title={`${gamesPlayed ?? 0} games played`}
              aria-label={`${gamesPlayed ?? 0} games played`}
            >
              {gamesPlayed ?? 0} G
            </span>
            {waitingSinceISO && (
              <span className="flex items-center gap-1 border border-border/60 rounded-full pl-1 pr-1.5 py-0.5">
                <Clock size={9} strokeWidth={2} className="text-muted/70" aria-hidden />
                <ElapsedTimer
                  startedAtISO={waitingSinceISO}
                  className="text-[10px] font-mono tabular-nums leading-none"
                  ariaLabel={(elapsed, isLong) =>
                    `Waiting ${elapsed}${isLong ? " — waiting a while" : ""}`
                  }
                />
              </span>
            )}
          </span>
        </div>

        {/* Skill, games played, and current standing */}
        <div className="flex items-center gap-1.5 min-w-0">
          <SkillBadge level={player.skillLevel} dense />
          {isInMatch && (
            <span className="ml-auto text-[9px] text-muted bg-surface-elevated px-1 py-0.5 rounded-full flex-shrink-0 font-medium leading-none">
              Playing
            </span>
          )}
          {!isInMatch && isSelected && (
            <span className="ml-auto text-[9px] text-bg bg-primary px-1 py-0.5 rounded-full flex-shrink-0 font-semibold leading-none">
              Selected
            </span>
          )}
        </div>

        {/* Actions, on their own line so the labels fit and stay tappable */}
        {!isInMatch && (onRemove || onReturnToQueue || onEdit) && (
          <AnimatePresence mode="wait" initial={false}>
            {confirmRemove ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.12, ease: EASE }}
                className="flex items-center gap-1"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove?.(); setConfirmRemove(false); }}
                  className="flex items-center gap-1 text-[10px] font-medium text-error border border-error/40 bg-error/10 hover:bg-error/20 px-2 py-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error/40"
                  aria-label={`Confirm remove ${displayName}`}
                >
                  <Check size={10} strokeWidth={2.5} aria-hidden />
                  Remove
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }}
                  className="text-[10px] font-medium text-muted hover:text-ink border border-border/60 hover:bg-surface-elevated px-2 py-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                >
                  Keep
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12, ease: EASE }}
                className="flex items-center gap-1"
              >
                {onEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className={ACTION_BTN}
                    aria-label={`Edit ${displayName}`}
                  >
                    Edit
                  </button>
                )}
                {/* "Rest", not a pause glyph: benching is resting, and the icon
                    read as pausing the wait timer. */}
                {onMoveToBench && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveToBench(); }}
                    className={ACTION_BTN}
                    aria-label={`Move ${displayName} to the bench`}
                  >
                    <Coffee size={9} strokeWidth={2} aria-hidden />
                    Rest
                  </button>
                )}
                {onReturnToQueue && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReturnToQueue(); }}
                    className={ACTION_BTN}
                    aria-label={`Return ${displayName} to the queue`}
                  >
                    Queue
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }}
                    className="ml-auto text-muted hover:text-error border border-border/60 hover:border-error/40 hover:bg-error/10 px-1.5 py-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error/40"
                    aria-label={`Remove ${displayName} from the session`}
                    title={`Remove ${displayName} from the session`}
                  >
                    <X size={10} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export function PlayerPoolColumn({
  queue,
  bench,
  gamesPlayedMap,
  slottedPlayerIds,
  onQueueRemove,
  onMoveToBench,
  onBenchReturnToQueue,
  onBenchRemove,
  onPlayerDragStart,
  onPlayerDragEnd,
  onAddPlayers,
  existingPlayerNames,
  selectedPlayerId,
  onSelectPlayer,
  armedCourtSlot,
  onEndpointDrop,
  showToast,
}: Props) {
  const isCourtPlayerArmed = !!armedCourtSlot;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // Collapsed by default: the point of moving these players out of QUEUE is a
  // shorter list. The group exists so they're findable and still actionable,
  // not so they're in the way.
  const [showMatched, setShowMatched] = useState(false);

  // Sort/filter is display-only and queue-scoped (bench is unaffected, always
  // shown in its existing unordered form). Not persisted across reloads.
  const [sortKey, setSortKey] = useState<QueueSortKey>("position");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [skillFilter, setSkillFilter] = useState<Set<SkillLevel>>(new Set());

  function handleSortKeyChange(key: QueueSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSkillFilter(level: SkillLevel) {
    setSkillFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function clearFilters() {
    setSkillFilter(new Set());
  }

  // True FIFO order — the array is already position-ordered by construction
  // elsewhere in the app; this is the one true position, independent of
  // whatever order the display sort below re-arranges rows into.
  // A player placed in a matchup card drops out of the queue list — seeing them
  // in both places was the confusion. This is a *render* filter only: the
  // QueueEntry itself is never touched, so enteredQueueAt keeps ticking and
  // sessionJoinedAt holds its FIFO seniority. That's what makes their wait time
  // and games-played continuous if they come back out of the card; removing and
  // rebuilding the entry is exactly where those would have reset.
  const allWaiting = queue.filter((e) => !e.isInMatch);
  const waitingQueue = allWaiting.filter((e) => !slottedPlayerIds.has(e.player.id));
  const matchedQueue = allWaiting.filter((e) => slottedPlayerIds.has(e.player.id));
  const waitingCount = waitingQueue.length;
  const isPanelEmpty = queue.length === 0 && bench.length === 0;
  const displayQueue = useMemo(() => {
    const filtered =
      skillFilter.size > 0 ? waitingQueue.filter((e) => skillFilter.has(e.player.skillLevel)) : waitingQueue;
    if (sortKey === "position") return filtered;
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "gamesPlayed":
          cmp = (gamesPlayedMap.get(a.player.id) ?? 0) - (gamesPlayedMap.get(b.player.id) ?? 0);
          break;
        case "waitingTime":
          // Ascending = earliest enteredQueueAt first = longest-waiting first.
          cmp = Date.parse(a.enteredQueueAt) - Date.parse(b.enteredQueueAt);
          break;
        case "skillLevel":
          cmp = SKILL_ORDER[a.player.skillLevel] - SKILL_ORDER[b.player.skillLevel];
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [waitingQueue, sortKey, sortDir, skillFilter, gamesPlayedMap]);

  const hasActiveSort = sortKey !== "position";
  const hasActiveFilters = skillFilter.size > 0;

  // Edit modal — reuses PlayerModal verbatim (same component /players opens
  // in edit mode), a second entry point onto the same shared save/remove
  // logic rather than a parallel implementation. Tracked by entryId+source
  // (not the Player object itself) so the modal always reflects the live
  // queue/bench props, not a stale snapshot taken when it was opened.
  const [editingEntry, setEditingEntry] = useState<{ entryId: string; source: "queue" | "bench" } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const editingPlayer = editingEntry
    ? (editingEntry.source === "queue"
        ? queue.find((e) => e.id === editingEntry.entryId)?.player
        : bench.find((e) => e.id === editingEntry.entryId)?.player) ?? null
    : null;

  function handleEditPlayer(entryId: string, source: "queue" | "bench") {
    setEditingEntry({ entryId, source });
    setIsEditModalOpen(true);
  }

  function handleEditModalClose() {
    setIsEditModalOpen(false);
    setTimeout(() => setEditingEntry(null), 220);
  }

  function handleEditSave(data: { name: string; skillLevel: SkillLevel; gender?: Gender; notes: string }) {
    if (!editingEntry) return;
    const patch = {
      name: data.name,
      skillLevel: data.skillLevel,
      gender: data.gender,
      notes: data.notes || undefined,
    };
    if (editingEntry.source === "queue") {
      updateQueuePlayer(editingEntry.entryId, patch);
    } else {
      updateBenchPlayer(editingEntry.entryId, patch);
    }
  }

  function handleEditRemove() {
    if (!editingEntry) return;
    const { entryId, source } = editingEntry;
    if (source === "queue") {
      const removed = removeQueueEntry(entryId);
      if (removed) {
        showToast(
          `Removed ${removed.player.name.split(" ")[0]} from the session`,
          () => restoreQueueEntry(removed),
          "Undo remove from session"
        );
      }
    } else {
      const removed = removeBenchEntry(entryId);
      if (removed) {
        showToast(
          `Removed ${removed.player.name.split(" ")[0]} from the session`,
          () => restoreBenchEntry(removed),
          "Undo remove from session"
        );
      }
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full flex flex-col rounded-lg border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2 flex-shrink-0 border-b border-border">
          <h2 className="flex items-baseline gap-1.5 text-sm font-semibold text-ink">
            Players
            <span className="font-mono text-xs text-muted font-normal tabular-nums">
              ({waitingCount + matchedQueue.length + bench.length})
            </span>
          </h2>
          <div className="flex items-center gap-1.5">
            <QueueSortPopover
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKeyChange={handleSortKeyChange}
              onSortDirToggle={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              skillFilter={skillFilter}
              onToggleSkillFilter={toggleSkillFilter}
              onClearFilters={clearFilters}
            />
            <button
              data-tutorial-target="add-players-button"
              onClick={() => setIsAddModalOpen(true)}
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2",
                isPanelEmpty
                  ? "text-primary bg-primary/10 border-primary/30 hover:bg-primary/15 focus-visible:ring-primary/50"
                  : "text-ink bg-surface-elevated hover:bg-surface-elevated/70 border-border focus-visible:ring-border"
              )}
              aria-label="Add players"
            >
              Add
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Queue section */}
          {queue.length > 0 && (
            <>
              <div className="px-3 pt-2.5 pb-1 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Queue
                </span>
                <span className="font-mono text-[10px] text-muted/60 tabular-nums">
                  {waitingCount}
                </span>
                {(hasActiveSort || hasActiveFilters) && (
                  <span className="flex items-center gap-1.5 ml-auto text-[10px] text-muted">
                    {hasActiveSort && <span>Sorted by {QUEUE_SORT_LABELS[sortKey]}</span>}
                    {hasActiveSort && hasActiveFilters && <span aria-hidden>·</span>}
                    {hasActiveFilters && (
                      <span>
                        {waitingCount - displayQueue.length} hidden
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSortKey("position");
                        setSortDir("asc");
                        clearFilters();
                      }}
                      className="text-primary hover:text-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                    >
                      Reset
                    </button>
                  </span>
                )}
              </div>
              {displayQueue.length > 0 ? (
                <ul role="list" aria-label="Queue" data-tutorial-target="queue-list" className="flex flex-col gap-1.5 px-2">
                  <AnimatePresence initial={false}>
                    {displayQueue.map((entry) => (
                      <motion.li
                        key={entry.id}
                        layout="position"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -12, transition: { duration: 0.15, ease: EASE } }}
                        transition={{ duration: 0.2, ease: EASE }}
                      >
                        <PlayerRow
                          player={entry.player}
                          isSelected={selectedPlayerId === entry.player.id}
                          isSwapTarget={isCourtPlayerArmed}
                          onEndpointDrop={onEndpointDrop}
                          endpoint={{ kind: "queue", playerId: entry.player.id }}
                          gamesPlayed={gamesPlayedMap.get(entry.player.id)}
                          waitingSinceISO={entry.enteredQueueAt}
                          onMoveToBench={() => onMoveToBench(entry.id)}
                          onRemove={() => onQueueRemove(entry.id)}
                          onEdit={() => handleEditPlayer(entry.id, "queue")}
                          onSelect={() => onSelectPlayer(entry.player)}
                          onDragStart={() => onPlayerDragStart(entry.player.id)}
                          onDragEnd={onPlayerDragEnd}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                  <p className="text-xs text-muted">No players match this filter</p>
                  <button
                    onClick={clearFilters}
                    className="text-xs text-primary hover:text-primary-hover transition-colors mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </>
          )}

          {/* In a matchup — players held by a planning card. Out of QUEUE so the
              waiting list means only "waiting", but still reachable: Rest and
              Remove both scrub them from their card on the way out. */}
          {matchedQueue.length > 0 && (
            <>
              <button
                onClick={() => setShowMatched((v) => !v)}
                aria-expanded={showMatched}
                className="w-full px-3 pt-3 pb-1 flex items-center gap-2 border-t border-border/40 mt-1 text-left hover:bg-surface-elevated/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
              >
                <ChevronRight
                  size={11}
                  strokeWidth={2.5}
                  className={cn("text-muted transition-transform", showMatched && "rotate-90")}
                  aria-hidden
                />
                <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  In a matchup
                </span>
                <span className="font-mono text-[10px] text-muted/60 tabular-nums">
                  {matchedQueue.length}
                </span>
              </button>
              {showMatched && (
                <ul role="list" aria-label="Players in a matchup" className="flex flex-col gap-1.5 px-2 pt-1">
                  <AnimatePresence initial={false}>
                    {matchedQueue.map((entry) => (
                      <motion.li
                        key={entry.id}
                        layout="position"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -12, transition: { duration: 0.15, ease: EASE } }}
                        transition={{ duration: 0.2, ease: EASE }}
                      >
                        <PlayerRow
                          player={entry.player}
                          isSelected={selectedPlayerId === entry.player.id}
                          gamesPlayed={gamesPlayedMap.get(entry.player.id)}
                          waitingSinceISO={entry.enteredQueueAt}
                          onMoveToBench={() => onMoveToBench(entry.id)}
                          onRemove={() => onQueueRemove(entry.id)}
                          onEdit={() => handleEditPlayer(entry.id, "queue")}
                          onSelect={() => onSelectPlayer(entry.player)}
                          onDragStart={() => onPlayerDragStart(entry.player.id)}
                          onDragEnd={onPlayerDragEnd}
                          endpoint={{ kind: "queue", playerId: entry.player.id }}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </>
          )}

          {/* Bench section */}
          {bench.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 flex items-center gap-2 border-t border-border/40 mt-1">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Bench
                </span>
                <span className="font-mono text-[10px] text-muted/60 tabular-nums">
                  {bench.length}
                </span>
              </div>
              <ul role="list" aria-label="Bench" className="flex flex-col gap-1.5 px-2">
                <AnimatePresence initial={false}>
                  {bench.map((entry) => (
                    <motion.li
                      key={entry.id}
                      layout="position"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -12, transition: { duration: 0.15, ease: EASE } }}
                      transition={{ duration: 0.2, ease: EASE }}
                    >
                      <PlayerRow
                        player={entry.player}
                        isSelected={selectedPlayerId === entry.player.id}
                        isSwapTarget={isCourtPlayerArmed}
                        onEndpointDrop={onEndpointDrop}
                        endpoint={{ kind: "bench", playerId: entry.player.id }}
                        gamesPlayed={gamesPlayedMap.get(entry.player.id)}
                        onReturnToQueue={() => onBenchReturnToQueue(entry.id)}
                        onRemove={() => onBenchRemove(entry.id)}
                        onEdit={() => handleEditPlayer(entry.id, "bench")}
                        onSelect={() => onSelectPlayer(entry.player)}
                        onDragStart={() => onPlayerDragStart(entry.player.id)}
                        onDragEnd={onPlayerDragEnd}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}

          {queue.length === 0 && bench.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-sm text-muted">No players</p>
              <p className="text-xs text-muted/60 mt-1">Add players to get started</p>
            </div>
          )}
        </div>
      </div>

      <AddPlayersModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={onAddPlayers}
        existingPlayerNames={existingPlayerNames}
      />

      <PlayerModal
        isOpen={isEditModalOpen}
        editingPlayer={editingPlayer}
        onClose={handleEditModalClose}
        onSave={handleEditSave}
        onRemove={handleEditRemove}
      />
    </MotionConfig>
  );
}
