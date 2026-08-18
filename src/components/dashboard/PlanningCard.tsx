"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Court, PlanningCard, MatchType, Player } from "@/types";
import type { SlotAddress } from "./DashboardClient";
import type { Endpoint } from "@/lib/roster-swap";
import { MatchupSlots } from "./MatchupSlots";
import { SkillBadge } from "@/components/ui/SkillBadge";
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
  onCourtsAssign: (courtId: string) => void;
  onRemovePlayer?: (side: "A" | "B", index: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDraggingAny: boolean;
  selectedPlayer?: Player | null;
  selectedChip: SlotAddress | null;
  onSlotTap: (side: "A" | "B", index: number) => void;
  onEndpointDrop?: (from: Endpoint, to: Endpoint) => void;
  onCancelChipSelection: () => void;
}

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

export function PlanningCard({
  card,
  availableCourts,
  fullWidth = false,
  onDismiss,
  onResuggest,
  justSuggested,
  onMatchTypeChange,
  onCourtsAssign,
  onRemovePlayer,
  onDragStart,
  onDragEnd,
  isDraggingAny,
  selectedPlayer,
  selectedChip,
  onSlotTap,
  onEndpointDrop,
  onCancelChipSelection,
}: Props) {
  const { state, matchType, suggestion } = card;

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
  // Every slot renders from these two arrays, whether or not a suggestion
  // exists yet — an untouched card is just an all-null grid, so the very
  // first placement is exactly as slot-precise as any later one.
  // A slot invites a click/drop when either kind of selection is armed — a
  // queue player waiting for a home, or an already-placed chip waiting to be
  // relocated or swapped. Filled chips are always clickable regardless (see
  // PlayerChip's own button styling), so this only gates empty slots.
  const canPlaceHere = !!selectedPlayer || !!selectedChip;
  const selectedName = selectedPlayer?.name;





  const borderClass =
    state === "empty"
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

      {/* Body — every slot is always rendered, empty or filled, so a
          drag/tap can target any specific slot from the card's very first
          placement onward; nothing auto-cascades into "next empty slot".
          Placed chips are themselves draggable and always tappable, so a
          player can be relocated or swapped into any slot on any card. */}
      <div className="flex-1 px-2.5 pb-1.5 pt-0.5">
        <MatchupSlots
          card={card}
          selectedChip={selectedChip}
          canPlaceHere={canPlaceHere}
          selectedName={selectedName}
          onSlotTap={onSlotTap}
          onRemovePlayer={onRemovePlayer}
          onEndpointDrop={onEndpointDrop}
        />
        {suggestion?.pairsExhausted && (
          <p className="text-[10px] text-muted mt-1.5 px-1.5">
            All unique pairs used — suggesting least recently repeated
          </p>
        )}
        {selectedChip?.cardId === card.id && (
          <div className="flex items-center justify-between mt-2 px-1.5">
            <p className="text-[10px] text-primary">Tap a slot to move, or a player to swap</p>
            <button
              onClick={onCancelChipSelection}
              className="text-[10px] text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border rounded-sm px-1"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 pb-2.5 pt-1.5 border-t border-border/60">
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
                data-tutorial-target={
                  state === "ready" && availableCourts.length > 0 ? "assign-to-court-button" : undefined
                }
                onClick={() => setIsPickingCourt(true)}
                disabled={state !== "ready" || availableCourts.length === 0}
                className={cn(
                  "w-full text-xs font-semibold py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
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
    </div>
  );
}
