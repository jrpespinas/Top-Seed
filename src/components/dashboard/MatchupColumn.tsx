"use client";

import { motion, AnimatePresence, MotionConfig } from "motion/react";
import type { Court, PlanningCard, MatchType, Player } from "@/types";
import { PlanningCard as PlanningCardComponent } from "./PlanningCard";
import type { SlotAddress } from "./DashboardClient";
import type { Endpoint } from "@/lib/roster-swap";
import { cn } from "@/lib/utils";

interface Props {
  planningCards: PlanningCard[];
  courts: Court[];
  draggingCardId: string | null;
  onCardDismiss: (id: string) => void;
  onCardMatchTypeChange: (id: string, type: MatchType) => void;
  onCardAssign: (cardId: string, courtId: string) => void;
  onCardDragStart: (cardId: string) => void;
  onCardDragEnd: () => void;
  onRemovePlayerFromCard: (cardId: string, side: "A" | "B", index: number) => void;
  onAddCard: () => void;
  onSuggestCard: () => void;
  onResuggestCard: (cardId: string) => void;
  justSuggestedCardIds?: Set<string>;
  selectedPlayer?: Player | null;
  selectedChip: SlotAddress | null;
  onSlotTap: (cardId: string, side: "A" | "B", index: number) => void;
  onEndpointDrop: (from: Endpoint, to: Endpoint) => void;
  onCancelChipSelection: () => void;
}

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

export function MatchupColumn({
  planningCards,
  courts,
  draggingCardId,
  onCardDismiss,
  onCardMatchTypeChange,
  onCardAssign,
  onCardDragStart,
  onCardDragEnd,
  onRemovePlayerFromCard,
  onAddCard,
  onSuggestCard,
  onResuggestCard,
  justSuggestedCardIds,
  selectedPlayer,
  selectedChip,
  onSlotTap,
  onEndpointDrop,
  onCancelChipSelection,
}: Props) {
  const availableCourts = courts.filter((c) => c.status === "AVAILABLE");

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full flex flex-col rounded-lg border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2 flex-shrink-0 border-b border-border">
          <h2 className="flex items-baseline gap-1.5 text-sm font-semibold text-ink">
            Queue
            <span className="font-mono text-xs text-muted font-normal tabular-nums">
              ({planningCards.length})
            </span>
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              data-tutorial-target="suggest-button"
              onClick={onSuggestCard}
              className="flex items-center gap-1 text-xs font-semibold bg-primary/10 hover:bg-primary text-primary hover:text-bg px-2.5 py-1.5 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Fill every open and partial matchup card from the queue"
              title="Fill every open and partial matchup card"
            >
              Suggest
            </button>
            <button
              onClick={onAddCard}
              className="flex items-center gap-1 text-xs font-medium text-ink bg-surface-elevated hover:bg-surface-elevated/70 px-2 py-1.5 rounded-sm border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
              aria-label="Add matchup card"
            >
              Add
            </button>
          </div>
        </div>

        {/* Cards list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5">
          {planningCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2.5 py-10 text-center">
              <p className="text-sm text-muted">No matchups planned</p>
              <button
                onClick={onAddCard}
                className={cn(
                  "text-xs text-muted hover:text-ink hover:bg-surface-elevated",
                  "px-3 py-1.5 rounded-md border border-border/60 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                )}
              >
                Add a card
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5" role="list" aria-label="Matchup cards">
              <AnimatePresence initial={false}>
                {planningCards.map((card) => (
                  <motion.li
                    key={card.id}
                    layout="position"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.97,
                      transition: { duration: 0.15, ease: EASE },
                    }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="list-none"
                  >
                    <PlanningCardComponent
                      card={card}
                      fullWidth
                      availableCourts={availableCourts}
                      onDismiss={() => onCardDismiss(card.id)}
                      onResuggest={() => onResuggestCard(card.id)}
                      justSuggested={justSuggestedCardIds?.has(card.id) ?? false}
                      onMatchTypeChange={(type) => onCardMatchTypeChange(card.id, type)}
                      onCourtsAssign={(courtId) => onCardAssign(card.id, courtId)}
                      onRemovePlayer={(side, index) =>
                        onRemovePlayerFromCard(card.id, side, index)
                      }
                      onDragStart={() => onCardDragStart(card.id)}
                      onDragEnd={onCardDragEnd}
                      isDraggingAny={draggingCardId !== null}
                      selectedPlayer={selectedPlayer}
                      selectedChip={selectedChip}
                      onSlotTap={(side, index) => onSlotTap(card.id, side, index)}
                      onEndpointDrop={onEndpointDrop}
                      onCancelChipSelection={onCancelChipSelection}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

      </div>
    </MotionConfig>
  );
}
