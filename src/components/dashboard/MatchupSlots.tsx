"use client";

import { useState } from "react";
import type { Player, PlanningCard as PlanningCardType } from "@/types";
import type { SlotAddress } from "./DashboardClient";
import { dragEndpointKind, readEndpointPayload, writeEndpointPayload } from "./DashboardClient";
import { canDrop, type Endpoint } from "@/lib/roster-swap";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { ElapsedTimer } from "@/components/ui/ElapsedTimer";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export type SlotRef = { side: "A" | "B"; index: number };

/**
 * The slot grid of a matchup — two sides with a `vs` divider between them.
 *
 * Extracted from PlanningCard so a court's staged "Next up" renders the exact
 * same thing. Duplicating it would mean two copies of the drag-origin gating
 * and endpoint payload wiring, which is precisely where three bugs already
 * came from once.
 */
export function MatchupSlots({
  card,
  selectedChip,
  canPlaceHere,
  selectedName,
  onSlotTap,
  onRemovePlayer,
  onEndpointDrop,
  waitingSince,
  gamesPlayed,
  peerMedianEnteredAt,
}: {
  card: PlanningCardType;
  selectedChip: SlotAddress | null;
  canPlaceHere: boolean;
  selectedName?: string;
  onSlotTap: (side: "A" | "B", index: number) => void;
  onRemovePlayer?: (side: "A" | "B", index: number) => void;
  onEndpointDrop?: (from: Endpoint, to: Endpoint) => void;
  /** playerId -> QueueEntry.enteredQueueAt. Waiting time lives on the queue
   * entry, not on Player, and a carded player keeps theirs (placement never
   * removes it) — which is the invariant that makes this renderable here. */
  waitingSince?: Map<string, string>;
  gamesPlayed?: Map<string, number>;
  peerMedianEnteredAt?: string;
}) {
  const [dragOverSlot, setDragOverSlot] = useState<SlotRef | null>(null);
  const rowCount = card.matchType === "DOUBLES" ? 2 : 1;
  const suggestion = card.suggestion;
  const sideA: (Player | null)[] = suggestion ? suggestion.sideA : Array(rowCount).fill(null);
  const sideB: (Player | null)[] = suggestion ? suggestion.sideB : Array(rowCount).fill(null);

  function dragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSlot(null);
  }

  function emptyDragOver(e: React.DragEvent, target: SlotRef) {
    if (!onEndpointDrop) return;
    const kind = dragEndpointKind(e);
    if (kind === null || !canDrop(kind, "card-empty")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(target);
  }

  function filledDragOver(e: React.DragEvent, target: SlotRef) {
    if (!onEndpointDrop) return;
    const kind = dragEndpointKind(e);
    if (kind === null || !canDrop(kind, "card-filled")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(target);
  }

  function drop(e: React.DragEvent, target: SlotRef) {
    setDragOverSlot(null);
    if (!onEndpointDrop) return;
    const from = readEndpointPayload(e);
    if (!from) return;
    e.preventDefault();
    onEndpointDrop(from, { kind: "card", cardId: card.id, side: target.side, index: target.index });
  }

  function renderSide(side: "A" | "B", players: (Player | null)[]) {
    return Array.from({ length: rowCount }, (_, i) => {
      const player = players[i] ?? null;
      const isDragOver = dragOverSlot?.side === side && dragOverSlot?.index === i;
      if (player) {
        return (
          <PlayerChip
            key={`${side}-${i}`}
            player={player}
            waitingSinceISO={waitingSince?.get(player.id)}
            gamesPlayed={gamesPlayed?.get(player.id)}
            peerMedianEnteredAt={peerMedianEnteredAt}
            isSelected={
              selectedChip?.cardId === card.id &&
              selectedChip?.side === side &&
              selectedChip?.index === i
            }
            isDragOver={isDragOver}
            onClick={() => onSlotTap(side, i)}
            onRemove={onRemovePlayer ? () => onRemovePlayer(side, i) : undefined}
            onDragStart={(e) => {
              e.stopPropagation();
              writeEndpointPayload(e, { kind: "card", cardId: card.id, side, index: i });
            }}
            onDragOver={(e) => filledDragOver(e, { side, index: i })}
            onDragLeave={dragLeave}
            onDrop={(e) => drop(e, { side, index: i })}
          />
        );
      }
      return (
        <div
          key={`${side}-empty-${i}`}
          onClick={canPlaceHere ? () => onSlotTap(side, i) : undefined}
          onDragOver={(e) => emptyDragOver(e, { side, index: i })}
          onDragLeave={dragLeave}
          onDrop={(e) => drop(e, { side, index: i })}
          role={canPlaceHere ? "button" : undefined}
          aria-label={canPlaceHere ? `Place ${selectedName ?? "selected player"} here` : undefined}
          className={cn(
            "h-8 rounded-sm border border-dashed transition-colors",
            isDragOver
              ? "border-primary/60 bg-primary/15 ring-1 ring-primary/30"
              : canPlaceHere
              ? "border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10"
              : "border-border/50"
          )}
        />
      );
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      {renderSide("A", sideA)}
      <div className="flex items-center gap-1.5 py-1">
        <div className="flex-1 border-t border-border/40" />
        <span className="text-[10px] font-medium text-muted/60">vs</span>
        <div className="flex-1 border-t border-border/40" />
      </div>
      {renderSide("B", sideB)}
    </div>
  );
}

function PlayerChip({
  player,
  waitingSinceISO,
  gamesPlayed,
  peerMedianEnteredAt,
  isSelected,
  isDragOver,
  onClick,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  player: Player;
  waitingSinceISO?: string;
  gamesPlayed?: number;
  peerMedianEnteredAt?: string;
  isSelected: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onRemove?: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      data-tutorial-target="placed-chip"
      className={cn(
        "relative group/chip rounded-sm cursor-grab active:cursor-grabbing transition-shadow",
        isDragOver && "ring-1 ring-primary/60 bg-primary/15"
      )}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1.5 w-full min-h-[30px] rounded-sm px-1.5 py-1 text-left transition-all duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          isSelected
            ? "bg-primary/12 ring-1 ring-primary/40"
            : "hover:bg-surface-elevated active:bg-surface-elevated"
        )}
      >
        <span className="text-xs text-ink truncate leading-none min-w-[44px]">{player.name}</span>
        <SkillBadge level={player.skillLevel} compact />
        {player.gender && <GenderIcon gender={player.gender} size={14} />}
        {/* Games then wait, same order as the player rows. Terser format here
            (`3g`, not `3 G`) — the chip is ~250px and already carries name,
            badge, gender and two numbers. */}
        <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[10px] font-mono tabular-nums text-muted leading-none"
            title={`${gamesPlayed ?? 0} games played`}
            aria-label={`${gamesPlayed ?? 0} games played`}
          >
            {gamesPlayed ?? 0}g
          </span>
          {waitingSinceISO && (
            <ElapsedTimer
              startedAtISO={waitingSinceISO}
              peerMedianStartedAtISO={peerMedianEnteredAt}
              className="text-[10px] font-mono tabular-nums leading-none"
              ariaLabel={(elapsed, isLong) =>
                `Waiting ${elapsed}${isLong ? " — waiting a while" : ""}`
              }
            />
          )}
        </span>
      </button>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${player.name}`}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 [@media(pointer:coarse)]:w-4 [@media(pointer:coarse)]:h-4 bg-surface-elevated border border-border rounded-full flex items-center justify-center text-muted hover:text-error hover:border-error/40 active:text-error active:border-error/40 transition-colors opacity-0 group-hover/chip:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <X size={7} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </div>
  );
}
