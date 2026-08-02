"use client";

import { useState } from "react";
import type { Court, Player, MatchResult } from "@/types";
import type { SlotAddress } from "./DashboardClient";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { ElapsedTimer } from "@/components/ui/ElapsedTimer";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmMode = "end" | "void" | "delete" | null;
type Slot = { side: "A" | "B"; index: number };

function sideLabel(players: Player[]) {
  return players.map((p) => p.name).join("/");
}

// A live match's player row is a substitution target only — it never starts
// a selection of its own (removing someone with no replacement ready is
// still Void/End's job), so it's clickable exactly when something else
// (a queue player or a placed chip) is already armed. Accepts either drag
// origin used elsewhere: a queue/bench row (application/x-player) or a
// placed chip from a planning card (application/x-slot).
function PlayerRow({
  player,
  canSubstitute,
  isDragOver,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  player: Player;
  canSubstitute: boolean;
  isDragOver: boolean;
  onClick?: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <span
      data-tutorial-target="court-player-row"
      onClick={canSubstitute ? onClick : undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role={canSubstitute ? "button" : undefined}
      aria-label={canSubstitute ? `Substitute in for ${player.name}` : undefined}
      className={cn(
        "flex items-center gap-1.5 min-w-0 rounded-sm px-1 -mx-1 py-0.5 transition-colors",
        isDragOver
          ? "ring-1 ring-primary/60 bg-primary/15"
          : canSubstitute
          ? "cursor-pointer hover:bg-surface-elevated"
          : undefined
      )}
    >
      <span className="text-xs text-ink truncate leading-none min-w-[44px]">
        {player.name}
      </span>
      <SkillBadge level={player.skillLevel} compact />
      {player.gender && <GenderIcon gender={player.gender} size={14} />}
    </span>
  );
}

interface CourtCardProps {
  court: Court;
  isDragging?: boolean;
  onDrop?: (courtId: string) => void;
  onDelete?: (id: string) => void;
  onEndMatch?: (courtId: string, result: MatchResult) => void;
  onVoidMatch?: (courtId: string) => void;
  selectedPlayer?: Player | null;
  selectedChip?: SlotAddress | null;
  onSubstituteFromQueue?: (courtId: string, side: "A" | "B", index: number, player: Player) => void;
  onSubstituteFromChip?: (courtId: string, side: "A" | "B", index: number, from: SlotAddress) => void;
  onSlotTap?: (courtId: string, side: "A" | "B", index: number) => void;
}

export function CourtCard({
  court,
  isDragging = false,
  onDrop,
  onDelete,
  onEndMatch,
  onVoidMatch,
  selectedPlayer,
  selectedChip,
  onSubstituteFromQueue,
  onSubstituteFromChip,
  onSlotTap,
}: CourtCardProps) {
  const { id: courtId, number, status, activeMatch } = court;
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<Slot | null>(null);

  const isDropTarget = isDragging && status === "AVAILABLE";
  const isBlocked = isDragging && status === "IN_USE";
  const canSubstitute = status === "IN_USE" && (!!selectedPlayer || !!selectedChip);

  function handleRowDragOver(e: React.DragEvent, slot: Slot) {
    const types = Array.from(e.dataTransfer.types);
    if (!types.includes("application/x-player") && !types.includes("application/x-slot")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slot);
  }

  function handleRowDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSlot(null);
    }
  }

  function handleRowDrop(e: React.DragEvent, slot: Slot) {
    setDragOverSlot(null);
    const rawPlayer = e.dataTransfer.getData("application/x-player");
    if (rawPlayer && onSubstituteFromQueue) {
      try {
        const player = JSON.parse(rawPlayer) as Player;
        e.preventDefault();
        onSubstituteFromQueue(courtId, slot.side, slot.index, player);
      } catch {
        // malformed data — ignore
      }
      return;
    }
    const rawSlot = e.dataTransfer.getData("application/x-slot");
    if (rawSlot && onSubstituteFromChip) {
      try {
        const from = JSON.parse(rawSlot) as { fromCardId: string; fromSide: "A" | "B"; fromIndex: number };
        e.preventDefault();
        onSubstituteFromChip(courtId, slot.side, slot.index, {
          cardId: from.fromCardId,
          side: from.fromSide,
          index: from.fromIndex,
        });
      } catch {
        // malformed data — ignore
      }
    }
  }

  return (
    <div
      onDragOver={(e) => {
        if (!isDropTarget) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (isDropTarget) onDrop?.(court.id);
      }}
      className={cn(
        "rounded-lg border bg-surface flex flex-col overflow-hidden transition-all duration-150",
        confirmMode === "delete"
          ? "border-border ring-1 ring-error/25"
          : confirmMode !== null
          ? "border-border ring-1 ring-primary/25"
          : "border-border",
        isDropTarget && isDragOver && "ring-2 ring-primary/50 bg-primary/12 border-primary/30",
        isDropTarget && !isDragOver && "ring-1 ring-primary/20",
        isBlocked && "opacity-40 cursor-not-allowed"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div>
          <span className="text-sm font-semibold text-ink">Court {number}</span>
          {status === "IN_USE" && activeMatch && (
            <span className="block text-xs text-muted mt-0.5">
              {activeMatch.matchType === "DOUBLES" ? "Doubles" : "Singles"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <StatusBadge status={status === "AVAILABLE" ? "available" : "in-use"} />

          {/* Delete button — hidden during delete confirm (confirm UI is already showing) */}
          {confirmMode !== "delete" && (
            status === "IN_USE" ? (
              <button
                aria-disabled
                tabIndex={-1}
                title="End the match first"
                className="p-3 text-muted/35 cursor-not-allowed focus-visible:outline-none"
                aria-label="Cannot delete a court with an active match"
              >
                <Trash2 size={13} strokeWidth={1.75} aria-hidden />
              </button>
            ) : (
              <button
                onClick={() => setConfirmMode("delete")}
                className="p-3 text-muted hover:text-error transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                aria-label={`Delete Court ${number}`}
              >
                <Trash2 size={13} strokeWidth={1.75} aria-hidden />
              </button>
            )
          )}
        </div>
      </div>

      {/* Body */}
      {status === "AVAILABLE" ? (
        <div className="flex-1 flex flex-col justify-end p-3 pt-1">
          {confirmMode === "delete" ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">Delete Court {number}?</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setConfirmMode(null);
                    onDelete?.(court.id);
                  }}
                  className="flex-1 text-xs font-semibold bg-error/15 text-error hover:bg-error/25 transition-colors py-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[44px]"
                  aria-label={`Confirm delete Court ${number}`}
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmMode(null)}
                  className="px-3 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[44px]"
                  aria-label="Cancel delete"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled
              title="Build a matchup in the Matchups panel, then assign it to this court"
              className="w-full flex items-center justify-center gap-1.5 bg-surface-elevated text-muted text-sm font-semibold py-2 rounded-md cursor-not-allowed opacity-60 min-h-[44px]"
              aria-label={`Start a new match on Court ${number} — build a matchup in the Matchups panel first`}
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden />
              New Match
            </button>
          )}
        </div>
      ) : activeMatch ? (
        <div className="flex-1 flex flex-col px-3 pb-3 gap-2">
          {/* Players */}
          <div className="flex flex-col gap-0.5">
            {activeMatch.sideA.map((p, i) => (
              <PlayerRow
                key={p.id}
                player={p}
                canSubstitute={canSubstitute}
                isDragOver={dragOverSlot?.side === "A" && dragOverSlot?.index === i}
                onClick={() => onSlotTap?.(courtId, "A", i)}
                onDragOver={(e) => handleRowDragOver(e, { side: "A", index: i })}
                onDragLeave={handleRowDragLeave}
                onDrop={(e) => handleRowDrop(e, { side: "A", index: i })}
              />
            ))}
            <span className="text-[11px] text-muted leading-none py-0.5">vs</span>
            {activeMatch.sideB.map((p, i) => (
              <PlayerRow
                key={p.id}
                player={p}
                canSubstitute={canSubstitute}
                isDragOver={dragOverSlot?.side === "B" && dragOverSlot?.index === i}
                onClick={() => onSlotTap?.(courtId, "B", i)}
                onDragOver={(e) => handleRowDragOver(e, { side: "B", index: i })}
                onDragLeave={handleRowDragLeave}
                onDrop={(e) => handleRowDrop(e, { side: "B", index: i })}
              />
            ))}
          </div>

          {/* Footer — normal or confirmation */}
          {confirmMode === null ? (
            <div className="flex items-center justify-between pt-2 border-t border-border mt-auto gap-2">
              <ElapsedTimer
                startedAtISO={activeMatch.startedAt}
                className="font-mono text-sm tabular-nums"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setConfirmMode("end")}
                  className="text-xs font-semibold text-bg bg-primary hover:bg-primary-hover transition-colors px-3 py-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[44px]"
                  aria-label={`End match on Court ${number} — record the result`}
                >
                  End Match
                </button>
                <button
                  onClick={() => setConfirmMode("void")}
                  className="text-xs text-muted hover:text-error hover:bg-error/10 transition-colors px-2.5 py-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[44px]"
                  aria-label={`Void match on Court ${number}`}
                >
                  Void
                </button>
              </div>
            </div>
          ) : confirmMode === "end" ? (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border mt-auto">
              <span className="text-xs text-muted">Who won?</span>
              <button
                onClick={() => {
                  setConfirmMode(null);
                  onEndMatch?.(court.id, "SIDE_A");
                }}
                className="w-full text-xs font-semibold text-ink bg-surface-elevated hover:bg-primary/15 hover:text-primary transition-colors py-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 min-h-[36px]"
              >
                {sideLabel(activeMatch.sideA)} won
              </button>
              <button
                onClick={() => {
                  setConfirmMode(null);
                  onEndMatch?.(court.id, "SIDE_B");
                }}
                className="w-full text-xs font-semibold text-ink bg-surface-elevated hover:bg-primary/15 hover:text-primary transition-colors py-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 min-h-[36px]"
              >
                {sideLabel(activeMatch.sideB)} won
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setConfirmMode(null);
                    onEndMatch?.(court.id, "DRAW");
                  }}
                  className="flex-1 text-xs font-medium text-muted hover:text-ink hover:bg-surface-elevated transition-colors py-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px]"
                >
                  Draw
                </button>
                <button
                  onClick={() => setConfirmMode(null)}
                  className="flex-1 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors py-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : confirmMode === "void" ? (
            <div className="flex flex-col gap-2 pt-2 border-t border-border mt-auto">
              <span className="text-xs text-muted">Void this match?</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setConfirmMode(null);
                    onVoidMatch?.(court.id);
                  }}
                  className="flex-1 text-xs font-semibold bg-error/15 text-error hover:bg-error/25 transition-colors py-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[36px]"
                >
                  Confirm Void
                </button>
                <button
                  onClick={() => setConfirmMode(null)}
                  className="px-3 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
