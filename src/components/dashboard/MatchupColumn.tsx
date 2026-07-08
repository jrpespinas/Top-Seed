"use client";

import { motion, AnimatePresence, MotionConfig } from "motion/react";
import type { Court, PlanningCard, MatchType, Player } from "@/types";
import { PlanningCard as PlanningCardComponent } from "./PlanningCard";
import { cn } from "@/lib/utils";
import { Swords, Plus, Shuffle } from "lucide-react";

interface Props {
  planningCards: PlanningCard[];
  courts: Court[];
  draggingCardId: string | null;
  onCardDismiss: (id: string) => void;
  onCardMatchTypeChange: (id: string, type: MatchType) => void;
  onCardSwap: (
    cardId: string,
    from: { side: "A" | "B"; index: number },
    to: { side: "A" | "B"; index: number }
  ) => void;
  onCardAssign: (cardId: string, courtId: string) => void;
  onCardDragStart: (cardId: string) => void;
  onCardDragEnd: () => void;
  onPlayerDropOnCard: (cardId: string, player: Player) => void;
  onRemovePlayerFromCard: (cardId: string, side: "A" | "B", index: number) => void;
  onAddCard: () => void;
  selectedPlayer?: Player | null;
}

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

export function MatchupColumn({
  planningCards,
  courts,
  draggingCardId,
  onCardDismiss,
  onCardMatchTypeChange,
  onCardSwap,
  onCardAssign,
  onCardDragStart,
  onCardDragEnd,
  onPlayerDropOnCard,
  onRemovePlayerFromCard,
  onAddCard,
  selectedPlayer,
}: Props) {
  const availableCourts = courts.filter((c) => c.status === "AVAILABLE");

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full flex flex-col rounded-lg border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2.5 flex-shrink-0 border-b border-border">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Swords size={14} strokeWidth={2} className="text-muted" aria-hidden />
            Matchups
            <span className="font-mono text-xs text-muted font-normal tabular-nums">
              ({planningCards.length})
            </span>
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              disabled
              title="Coming soon — build matchups manually below for now"
              className="flex items-center gap-1 text-xs font-semibold bg-surface-elevated text-muted px-2.5 py-1.5 rounded-sm cursor-not-allowed opacity-60"
              aria-label="Suggest a matchup from the queue — coming soon"
            >
              <Shuffle size={11} strokeWidth={2.5} aria-hidden />
              Suggest
            </button>
            <button
              onClick={onAddCard}
              className="flex items-center gap-1 text-xs text-muted hover:text-ink hover:bg-surface-elevated px-2 py-1.5 rounded-sm border border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
              aria-label="Add matchup card"
            >
              <Plus size={11} strokeWidth={2.5} aria-hidden />
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
                      onMatchTypeChange={(type) => onCardMatchTypeChange(card.id, type)}
                      onSwap={(from, to) => onCardSwap(card.id, from, to)}
                      onCourtsAssign={(courtId) => onCardAssign(card.id, courtId)}
                      onPlayerDrop={(player) => onPlayerDropOnCard(card.id, player)}
                      onRemovePlayer={(side, index) =>
                        onRemovePlayerFromCard(card.id, side, index)
                      }
                      onDragStart={() => onCardDragStart(card.id)}
                      onDragEnd={onCardDragEnd}
                      isDraggingAny={draggingCardId !== null}
                      selectedPlayer={selectedPlayer}
                      onPlaceSelectedPlayer={
                        selectedPlayer ? () => onPlayerDropOnCard(card.id, selectedPlayer) : undefined
                      }
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
