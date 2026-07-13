"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Court, PlanningCard, MatchType, Player } from "@/types";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { cn } from "@/lib/utils";
import { X, GripVertical, RotateCcw } from "lucide-react";

interface Props {
  card: PlanningCard;
  availableCourts: Court[];
  fullWidth?: boolean;
  onDismiss: () => void;
  onResuggest?: () => void;
  justSuggested?: boolean;
  onMatchTypeChange: (type: MatchType) => void;
  onSwap: (
    from: { side: "A" | "B"; index: number },
    to: { side: "A" | "B"; index: number }
  ) => void;
  onCourtsAssign: (courtId: string) => void;
  onPlayerDrop?: (player: Player) => void;
  onRemovePlayer?: (side: "A" | "B", index: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDraggingAny: boolean;
  selectedPlayer?: Player | null;
  onPlaceSelectedPlayer?: () => void;
}

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

type ChipRef = { side: "A" | "B"; index: number } | null;

function getNextEmptySlot(
  suggestion: PlanningCard["suggestion"],
  matchType: MatchType
): { side: "A" | "B"; index: number } | null {
  const max = matchType === "DOUBLES" ? 2 : 1;
  if (!suggestion) return { side: "A", index: 0 };
  for (let i = 0; i < max; i++) {
    if (!suggestion.sideA[i]) return { side: "A", index: i };
  }
  for (let i = 0; i < max; i++) {
    if (!suggestion.sideB[i]) return { side: "B", index: i };
  }
  return null;
}

function PlayerChip({
  player,
  isSelected,
  onClick,
  onRemove,
}: {
  player: Player;
  isSelected: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  const displayName = player.name;
  return (
    <div className="relative group/chip">
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1.5 w-full min-h-[36px] rounded-sm px-1.5 py-1.5 text-left transition-all duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          isSelected
            ? "bg-primary/12 ring-1 ring-primary/40"
            : "hover:bg-surface-elevated active:bg-surface-elevated"
        )}
      >
        <span className="text-xs text-ink truncate leading-none min-w-[44px]">
          {displayName}
        </span>
        <SkillBadge level={player.skillLevel} compact />
        {player.gender && <GenderIcon gender={player.gender} size={14} />}
      </button>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${displayName}`}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 [@media(pointer:coarse)]:w-4 [@media(pointer:coarse)]:h-4 bg-surface-elevated border border-border rounded-full flex items-center justify-center text-muted hover:text-error hover:border-error/40 active:text-error active:border-error/40 transition-colors opacity-0 group-hover/chip:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <X size={7} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </div>
  );
}

export function PlanningCard({
  card,
  availableCourts,
  fullWidth = false,
  onDismiss,
  onResuggest,
  justSuggested,
  onMatchTypeChange,
  onSwap,
  onCourtsAssign,
  onPlayerDrop,
  onRemovePlayer,
  onDragStart,
  onDragEnd,
  isDraggingAny,
  selectedPlayer,
  onPlaceSelectedPlayer,
}: Props) {
  const { state, matchType, suggestion } = card;

  const [selectedChip, setSelectedChip] = useState<ChipRef>(null);
  const [isDragOverForPlayer, setIsDragOverForPlayer] = useState(false);
  const [isPickingCourt, setIsPickingCourt] = useState(false);
  const assignBtnRef = useRef<HTMLButtonElement>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (prevStateRef.current !== "ready" && state === "ready") {
      const btn = assignBtnRef.current;
      if (btn && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        btn.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.08)" },
            { transform: "scale(1)" },
          ],
          { duration: 400, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }
        );
      }
    }
    prevStateRef.current = state;
  }, [state]);
  const rowCount = matchType === "DOUBLES" ? 2 : 1;
  const isFull = getNextEmptySlot(suggestion, matchType) === null;
  const nextEmpty = isDragOverForPlayer ? getNextEmptySlot(suggestion, matchType) : null;
  const canPlaceHere = !!selectedPlayer && !isFull;
  const selectedName = selectedPlayer?.name;

  function handleChipClick(side: "A" | "B", index: number) {
    if (!selectedChip) {
      setSelectedChip({ side, index });
      return;
    }
    if (selectedChip.side === side && selectedChip.index === index) {
      setSelectedChip(null);
      return;
    }
    onSwap(selectedChip, { side, index });
    setSelectedChip(null);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!onPlayerDrop) return;
    if (!Array.from(e.dataTransfer.types).includes("application/x-player")) return;
    if (isFull) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOverForPlayer(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverForPlayer(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    setIsDragOverForPlayer(false);
    if (!onPlayerDrop) return;
    const raw = e.dataTransfer.getData("application/x-player");
    if (!raw) return;
    try {
      const player = JSON.parse(raw) as Player;
      e.preventDefault();
      onPlayerDrop(player);
    } catch {
      // malformed data — ignore
    }
  }

  const borderClass = isDragOverForPlayer
    ? "border-primary/60 ring-1 ring-primary/20"
    : state === "empty"
    ? "border-dashed border-border/50"
    : state === "ready"
    ? "border-primary/40"
    : "border-border";

  const isDraggable = state === "ready";

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-card", card.id);
        e.dataTransfer.effectAllowed = "move";
        if (dragPreviewRef.current) {
          e.dataTransfer.setDragImage(dragPreviewRef.current, 16, 16);
        }
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex-shrink-0 rounded-lg border bg-surface flex flex-col transition-all duration-150",
        fullWidth ? "w-full" : "w-[76vw] md:w-[252px]",
        borderClass,
        isDraggable && "cursor-grab active:cursor-grabbing",
        isDraggingAny && isDraggable && "opacity-50 scale-[0.98]",
        justSuggested && "animate-suggest-pulse"
      )}
    >
      {/* Custom drag image — offscreen, only rasterized by the browser during drag */}
      {isDraggable && suggestion && (
        <div
          ref={dragPreviewRef}
          aria-hidden
          className="fixed -top-[9999px] left-0 flex flex-col gap-1.5 w-[180px] px-3 py-2.5 rounded-lg border border-primary/40 bg-surface shadow-lg"
        >
          <span className="text-[10px] font-semibold text-primary self-start">
            {matchType === "DOUBLES" ? "2v2" : "1v1"}
          </span>
          <div className="flex flex-col gap-0.5">
            {suggestion.sideA.filter((p): p is Player => p !== null).map((p) => (
              <div key={`preview-a-${p.id}`} className="flex items-center gap-1.5">
                <span className="text-xs text-ink truncate flex-1 min-w-0">{p.name}</span>
                <SkillBadge level={p.skillLevel} compact />
              </div>
            ))}
          </div>
          <span className="text-[9px] text-muted/60 text-center">vs</span>
          <div className="flex flex-col gap-0.5">
            {suggestion.sideB.filter((p): p is Player => p !== null).map((p) => (
              <div key={`preview-b-${p.id}`} className="flex items-center gap-1.5">
                <span className="text-xs text-ink truncate flex-1 min-w-0">{p.name}</span>
                <SkillBadge level={p.skillLevel} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-0.5">
          {(["SINGLES", "DOUBLES"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                if (matchType !== t) onMatchTypeChange(t);
              }}
              className={cn(
                "text-[11px] font-medium px-2 py-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
                matchType === t
                  ? "bg-surface-elevated text-ink"
                  : "text-muted hover:text-ink"
              )}
            >
              {t === "SINGLES" ? "1v1" : "2v2"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          {isDraggable && (
            <GripVertical size={12} strokeWidth={1.75} className="text-muted/40 mx-0.5" aria-hidden />
          )}
          {onResuggest && (
            <button
              onClick={onResuggest}
              className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              aria-label="Resuggest this matchup"
              title="Resuggest"
            >
              <RotateCcw size={11} strokeWidth={2} aria-hidden />
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1.5 text-muted hover:text-error hover:bg-error/10 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error/40"
            aria-label="Dismiss this planning card"
          >
            <X size={11} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* Body */}
      {state === "empty" && !isDragOverForPlayer ? (
        <div
          onClick={canPlaceHere ? onPlaceSelectedPlayer : undefined}
          className={cn(
            "flex-1 flex items-center justify-center px-3 pb-5 pt-2 min-h-[100px] transition-colors rounded-md",
            canPlaceHere && "cursor-pointer hover:bg-primary/10"
          )}
        >
          <p className={cn("text-xs text-center", canPlaceHere ? "text-primary" : "text-muted")}>
            {canPlaceHere
              ? `Tap to place ${selectedName}`
              : onPlayerDrop
              ? "Drop a player to fill this card"
              : "Not enough players in queue"}
          </p>
        </div>
      ) : (
        <div className="flex-1 px-3 pb-2 pt-0.5">
          {/* Empty card receiving first player drop */}
          {state === "empty" && isDragOverForPlayer && (
            <div className="h-7 rounded-sm border border-primary/50 bg-primary/10 mb-1" />
          )}
          {suggestion && (
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: rowCount }, (_, i) => {
                const playerA = suggestion.sideA[i] ?? null;
                const highlightA = nextEmpty?.side === "A" && nextEmpty?.index === i;
                return playerA ? (
                  <PlayerChip
                    key={`a-${i}`}
                    player={playerA}
                    isSelected={selectedChip?.side === "A" && selectedChip?.index === i}
                    onClick={() => handleChipClick("A", i)}
                    onRemove={onRemovePlayer ? () => onRemovePlayer("A", i) : undefined}
                  />
                ) : (
                  <div
                    key={`a-empty-${i}`}
                    onClick={canPlaceHere ? onPlaceSelectedPlayer : undefined}
                    role={canPlaceHere ? "button" : undefined}
                    aria-label={canPlaceHere ? `Place ${selectedName} here` : undefined}
                    className={cn(
                      "h-9 rounded-sm border border-dashed transition-colors",
                      highlightA
                        ? "border-primary/50 bg-primary/10"
                        : canPlaceHere
                        ? "border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10"
                        : "border-border/50"
                    )}
                  />
                );
              })}
              <div className="flex items-center gap-1.5 py-1">
                <div className="flex-1 border-t border-border/40" />
                <span className="text-[10px] font-medium text-muted/60">vs</span>
                <div className="flex-1 border-t border-border/40" />
              </div>
              {Array.from({ length: rowCount }, (_, i) => {
                const playerB = suggestion.sideB[i] ?? null;
                const highlightB = nextEmpty?.side === "B" && nextEmpty?.index === i;
                return playerB ? (
                  <PlayerChip
                    key={`b-${i}`}
                    player={playerB}
                    isSelected={selectedChip?.side === "B" && selectedChip?.index === i}
                    onClick={() => handleChipClick("B", i)}
                    onRemove={onRemovePlayer ? () => onRemovePlayer("B", i) : undefined}
                  />
                ) : (
                  <div
                    key={`b-empty-${i}`}
                    onClick={canPlaceHere ? onPlaceSelectedPlayer : undefined}
                    role={canPlaceHere ? "button" : undefined}
                    aria-label={canPlaceHere ? `Place ${selectedName} here` : undefined}
                    className={cn(
                      "h-9 rounded-sm border border-dashed transition-colors",
                      highlightB
                        ? "border-primary/50 bg-primary/10"
                        : canPlaceHere
                        ? "border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10"
                        : "border-border/50"
                    )}
                  />
                );
              })}
            </div>
          )}
          {suggestion?.pairsExhausted && (
            <p className="text-[10px] text-muted mt-1.5 px-1.5">
              All unique pairs used — suggesting least recently repeated
            </p>
          )}
          {selectedChip && (
            <div className="flex items-center justify-between mt-2 px-1.5">
              <p className="text-[10px] text-primary">Tap another player to swap</p>
              <button
                onClick={() => setSelectedChip(null)}
                className="text-[10px] text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border rounded-sm px-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {state !== "empty" && (
        <div className="px-3 pb-3 pt-2 border-t border-border/60">
          <AnimatePresence mode="wait" initial={false}>
            {isPickingCourt ? (
              <motion.div
                key="picker"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15, ease: EASE }}
                className="space-y-2"
              >
                <p className="text-[10px] text-muted">Assign to court:</p>
                <div className="flex flex-wrap gap-1">
                  {availableCourts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onCourtsAssign(c.id);
                        setIsPickingCourt(false);
                      }}
                      className="text-xs font-semibold bg-primary/10 hover:bg-primary text-primary hover:text-bg px-2.5 py-1.5 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                    >
                      Court {c.number}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setIsPickingCourt(false)}
                  className="text-[10px] text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border rounded-sm"
                >
                  Cancel
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="assign"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: EASE }}
              >
                <button
                  ref={assignBtnRef}
                  onClick={() => setIsPickingCourt(true)}
                  disabled={state !== "ready" || availableCourts.length === 0}
                  className={cn(
                    "w-full text-xs font-semibold py-2.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    state === "ready" && availableCourts.length > 0
                      ? "bg-primary hover:bg-primary-hover text-bg"
                      : "bg-surface-elevated text-muted cursor-not-allowed opacity-60"
                  )}
                  title={
                    state !== "ready"
                      ? "Fill all player slots first"
                      : availableCourts.length === 0
                      ? "No courts available"
                      : undefined
                  }
                  aria-label="Assign to court"
                >
                  {state !== "ready" ? "Fill all slots to assign" : "Assign to court"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
