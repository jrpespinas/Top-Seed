"use client";

import { useState } from "react";
import type { Court, Player, MatchResult } from "@/types";
import type { CourtSlotAddress } from "./DashboardClient";
import { dragEndpointKind, readEndpointPayload, writeEndpointPayload } from "./DashboardClient";
import { canDrop, type Endpoint } from "@/lib/roster-swap";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { ElapsedTimer } from "@/components/ui/ElapsedTimer";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerMenuTrigger, PlayerMoreButton, NO_TOUCH_CALLOUT, type MenuPoint } from "./PlayerMenu";

type ConfirmMode = "end" | "void" | "delete" | null;
type Slot = { side: "A" | "B"; index: number };

function sideLabel(players: Player[]) {
  return players.map((p) => p.name).join("/");
}

// A live match's player row is both a swap source and a swap target. It used
// to be target-only, which meant reshuffling a live match required voiding it —
// and voiding credits gamesPlayed to everyone, so the roster edit cost the
// organizer real data. Picking a player up here is deliberate (arm, then pick a
// destination) rather than a one-tap action, because the destination decides
// where the player standing here ends up.
function PlayerRow({
  player,
  isArmed,
  isTarget,
  isDragOver,
  wide = false,
  onClick,
  onOpenMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  player: Player;
  isArmed: boolean;
  isTarget: boolean;
  isDragOver: boolean;
  // Stacked name-over-badge instead of a single inline row — legible from
  // across a gym, and it fills the width a full-span court card actually has.
  wide?: boolean;
  onClick?: () => void;
  onOpenMenu?: (point: MenuPoint) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const { triggerProps, cancel } = usePlayerMenuTrigger(onOpenMenu ?? (() => {}));
  // The ⋯ is a sibling in a flex row rather than overlaid, because on the
  // 176px tablet strip an overlaid button would sit on top of the gender icon.
  // Its slot is reserved even while it's hover-hidden, so rows don't shift.
  return (
    <span className={cn("group/courtrow flex min-w-0", wide ? "items-start" : "items-center")}>
    {/* Balances the ⋯ slot on the other side, so a wide card's centred name
        stays centred on the column rather than 10px left of it. */}
    {wide && onOpenMenu && <span className="w-5 flex-shrink-0" aria-hidden />}
    <span
      data-tutorial-target="court-player-row"
      draggable
      onClick={onClick}
      {...(onOpenMenu ? triggerProps : {})}
      onDragStart={(e) => {
        cancel();
        onDragStart(e);
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onClick?.();
      }}
      aria-pressed={isArmed}
      aria-label={
        isArmed
          ? `${player.name} selected — pick someone to swap with`
          : isTarget
          ? `Swap with ${player.name}`
          : `Select ${player.name} to swap`
      }
      className={cn(
        "flex-1 min-w-0 rounded-sm transition-colors cursor-grab active:cursor-grabbing",
        NO_TOUCH_CALLOUT,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        wide
          ? "flex flex-col items-center gap-0.5 px-1.5 py-1 text-center"
          : "flex items-center gap-1.5 px-1 -mx-1 py-0.5",
        isDragOver
          ? "ring-1 ring-primary/60 bg-primary/15"
          : isArmed
          ? "bg-primary/12 ring-1 ring-primary/40"
          : isTarget
          ? "ring-1 ring-primary/25 hover:bg-surface-elevated"
          : "hover:bg-surface-elevated"
      )}
    >
      {wide ? (
        <>
          <span className="flex items-center gap-1.5 min-w-0 max-w-full">
            <span className="text-[13px] font-medium text-ink truncate leading-tight">
              {player.name}
            </span>
            {player.gender && <GenderIcon gender={player.gender} />}
          </span>
          <SkillBadge level={player.skillLevel} dense />
        </>
      ) : (
        <>
          <span className="text-xs text-ink truncate leading-none min-w-[44px]">
            {player.name}
          </span>
          <SkillBadge level={player.skillLevel} compact />
          {player.gender && <GenderIcon gender={player.gender} size={14} />}
        </>
      )}
    </span>
    {onOpenMenu && (
      <PlayerMoreButton
        playerName={player.name}
        groupName="courtrow"
        onOpen={onOpenMenu}
        className={cn("flex-shrink-0", wide && "mt-0.5")}
      />
    )}
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
  hasArmedSelection?: boolean;
  armedCourtSlot?: CourtSlotAddress | null;
  onEndpointDrop?: (from: Endpoint, to: Endpoint) => void;
  onSlotTap?: (courtId: string, side: "A" | "B", index: number) => void;
  onCancelSelection?: () => void;
  onOpenPlayerMenu?: (playerId: string, point: MenuPoint) => void;
  // "wide" sets the two sides as half-columns either side of a VS divider
  // instead of stacking them — the default everywhere the card gets at least
  // ~300px. "compact" survives only for the tablet strip, whose cards are
  // 176px wide (w-44): too narrow to split in half without the full-label
  // skill badges wrapping. Interaction is byte-identical in both.
  variant?: "compact" | "wide";
}

export function CourtCard({
  court,
  isDragging = false,
  onDrop,
  onDelete,
  onEndMatch,
  onVoidMatch,
  hasArmedSelection = false,
  armedCourtSlot,
  onEndpointDrop,
  onSlotTap,
  onCancelSelection,
  onOpenPlayerMenu,
  variant = "compact",
}: CourtCardProps) {
  const { id: courtId, number, status, activeMatch } = court;
  const inUse = status === "IN_USE";
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<Slot | null>(null);

  const isDropTarget = isDragging && status === "AVAILABLE";
  const isBlocked = isDragging && status === "IN_USE";
  const isArmedHere = (side: "A" | "B", index: number) =>
    armedCourtSlot?.courtId === courtId && armedCourtSlot.side === side && armedCourtSlot.index === index;

  function handleRowDragOver(e: React.DragEvent, slot: Slot) {
    const kind = dragEndpointKind(e);
    if (kind === null || !canDrop(kind, "court")) return;
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
    if (!onEndpointDrop) return;
    const from = readEndpointPayload(e);
    if (!from) return;
    e.preventDefault();
    onEndpointDrop(from, { kind: "court", courtId, side: slot.side, index: slot.index });
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
      {/* Scoreboard band. Organisers couldn't spot the court number, and the
          card read as one more white card beside the matchup cards. The band
          fixes both: the number is the largest thing on the card, and its
          ground says the status from across the room. Near-black while a match
          is on, light blue while the court is free, so free courts can be
          counted at a glance. It uses the ink colour rather than brand blue on
          purpose: blue stays reserved for things you can press. The violet
          "In Use" pill this replaced said the same thing less visibly. */}
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2",
          inUse ? "bg-ink text-bg" : "bg-primary-tint text-primary"
        )}
      >
        <div className="flex flex-col leading-none flex-shrink-0">
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.14em]",
              inUse ? "text-bg/65" : "text-primary/70"
            )}
          >
            Court
          </span>
          <span
            className={cn(
              "font-mono font-bold tabular-nums mt-0.5",
              variant === "wide" ? "text-[32px]" : "text-[26px]"
            )}
          >
            {number}
          </span>
        </div>

        <div className="ml-auto flex flex-col items-end gap-0.5 min-w-0 text-right">
          {inUse && activeMatch ? (
            <>
              <ElapsedTimer
                startedAtISO={activeMatch.startedAt}
                tone="dark"
                className={cn(
                  "font-mono tabular-nums font-medium leading-none",
                  variant === "wide" ? "text-lg" : "text-[15px]"
                )}
              />
              <span className="text-[11px] text-bg/70 truncate max-w-full">
                In use · {activeMatch.matchType === "DOUBLES" ? "Doubles" : "Singles"}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-medium text-muted">Open</span>
          )}
        </div>

        {/* Delete. Hidden during delete confirm, since the confirm UI is showing. */}
        {confirmMode !== "delete" &&
          (inUse ? (
            <button
              aria-disabled
              tabIndex={-1}
              title="End the match first"
              className="-mr-1 p-2 text-bg/30 cursor-not-allowed focus-visible:outline-none"
              aria-label="Cannot delete a court with an active match"
            >
              <Trash2 size={13} strokeWidth={1.75} aria-hidden />
            </button>
          ) : (
            <button
              onClick={() => setConfirmMode("delete")}
              className="-mr-1 p-2 text-primary/60 hover:text-error transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
              aria-label={`Delete Court ${number}`}
            >
              <Trash2 size={13} strokeWidth={1.75} aria-hidden />
            </button>
          ))}
      </div>

      {/* Body */}
      {status === "AVAILABLE" ? (
        <div className="flex-1 flex flex-col justify-end p-2.5">
          {confirmMode === "delete" ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">Delete Court {number}?</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setConfirmMode(null);
                    onDelete?.(court.id);
                  }}
                  className="flex-1 text-xs font-semibold bg-error/15 text-error hover:bg-error/25 transition-colors py-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[38px]"
                  aria-label={`Confirm delete Court ${number}`}
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmMode(null)}
                  className="px-3 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[38px]"
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
              className="w-full flex items-center justify-center gap-1.5 bg-surface-elevated text-muted text-[13px] font-semibold py-1.5 rounded-md cursor-not-allowed opacity-60 min-h-[38px]"
              aria-label={`Start a new match on Court ${number} — build a matchup in the Matchups panel first`}
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden />
              New Match
            </button>
          )}
        </div>
      ) : activeMatch ? (
        <div className="flex-1 flex flex-col px-2.5 pt-2.5 pb-2.5 gap-1.5">
          {/* Players. Compact stacks both sides with a "vs" between; wide sets
              them as half-columns across a centre divider, which is what makes
              a match readable at a glance from a few metres away. */}
          {(() => {
            const row = (p: Player, side: "A" | "B", i: number) => (
              <PlayerRow
                key={p.id}
                player={p}
                isArmed={isArmedHere(side, i)}
                isTarget={hasArmedSelection && !isArmedHere(side, i)}
                isDragOver={dragOverSlot?.side === side && dragOverSlot?.index === i}
                wide={variant === "wide"}
                onClick={() => onSlotTap?.(courtId, side, i)}
                onOpenMenu={onOpenPlayerMenu ? (point) => onOpenPlayerMenu(p.id, point) : undefined}
                onDragStart={(e) => writeEndpointPayload(e, { kind: "court", courtId, side, index: i })}
                onDragOver={(e) => handleRowDragOver(e, { side, index: i })}
                onDragLeave={handleRowDragLeave}
                onDrop={(e) => handleRowDrop(e, { side, index: i })}
              />
            );

            if (variant === "wide") {
              return (
                <div className="rounded-md border border-border/60 p-1.5">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                    <div className="flex flex-col gap-1 min-w-0">
                      {activeMatch.sideA.map((p, i) => row(p, "A", i))}
                    </div>
                    <div className="flex flex-col items-center self-stretch gap-1">
                      <span className="flex-1 w-px border-l border-dashed border-border" aria-hidden />
                      <span className="text-[9px] font-semibold text-muted tracking-wide px-1 py-0.5 rounded-full border border-border">
                        VS
                      </span>
                      <span className="flex-1 w-px border-l border-dashed border-border" aria-hidden />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      {activeMatch.sideB.map((p, i) => row(p, "B", i))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-0.5">
                {activeMatch.sideA.map((p, i) => row(p, "A", i))}
                <span className="text-[11px] text-muted leading-none py-0.5">vs</span>
                {activeMatch.sideB.map((p, i) => row(p, "B", i))}
              </div>
            );
          })()}


          {/* Mirrors PlanningCard's chip-selection banner so the two panels read
              as one system. Wording differs on purpose: a chip can relocate
              into an empty slot, a court player can only ever trade places. */}
          {armedCourtSlot?.courtId === courtId && (
            <div className="flex items-center justify-between gap-2 -mt-1">
              <p className="text-[10px] text-primary">Tap a player to swap</p>
              <button
                onClick={onCancelSelection}
                className="text-[10px] text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border rounded-sm px-1"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Footer — normal or confirmation */}
          {confirmMode === null ? (
            <div className="flex items-center justify-end pt-1.5 border-t border-border mt-auto gap-2">
              <div className="flex gap-1">
                <button
                  onClick={() => setConfirmMode("end")}
                  className="text-xs font-semibold text-bg bg-primary hover:bg-primary-hover transition-colors px-3 py-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[38px]"
                  aria-label={`End match on Court ${number} — record the result`}
                >
                  End Match
                </button>
                <button
                  onClick={() => setConfirmMode("void")}
                  className="text-xs text-muted hover:text-error hover:bg-error/10 transition-colors px-2.5 py-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[38px]"
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
