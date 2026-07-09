"use client";

import { useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import type { QueueEntry, BenchEntry, Player } from "@/types";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { ElapsedTimer } from "@/components/ui/ElapsedTimer";
import { AddPlayersModal, type NewPlayerInput } from "./AddPlayersModal";
import { cn } from "@/lib/utils";
import {
  Users,
  Plus,
  GripVertical,
  PauseCircle,
  PlayCircle,
  X,
  Check,
} from "lucide-react";

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
}

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

function PlayerRow({
  player,
  position,
  isInMatch,
  isSlotted,
  isSelected,
  gamesPlayed,
  waitingSinceISO,
  onMoveToBench,
  onReturnToQueue,
  onRemove,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  player: Player;
  position?: number;
  isInMatch?: boolean;
  isSlotted?: boolean;
  isSelected?: boolean;
  gamesPlayed?: number;
  // Queue rows only — how long this player has been in their current queue
  // position (not total session time; see QueueEntry.enteredQueueAt).
  waitingSinceISO?: string;
  onMoveToBench?: () => void;
  onReturnToQueue?: () => void;
  onRemove?: () => void;
  onSelect?: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const firstName = player.name.split(" ")[0];

  const dimmed = isInMatch;

  return (
    <div
      draggable={!isInMatch}
      onClick={!isInMatch ? onSelect : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-player", JSON.stringify(player));
        e.dataTransfer.effectAllowed = "copy";
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 border-b border-border/40 last:border-b-0 min-h-[44px] transition-colors group",
        !isInMatch && "hover:bg-surface-elevated/40 active:bg-surface-elevated/60 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        dimmed && "opacity-50",
        isSelected && "bg-primary/10 hover:bg-primary/12"
      )}
    >
      {/* Grip + position */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {!isInMatch && (
          <GripVertical
            size={10}
            strokeWidth={1.75}
            className="text-muted/60 group-hover:text-muted/80 transition-colors flex-shrink-0"
            aria-hidden
          />
        )}
        {position !== undefined && (
          <span className="font-mono text-[10px] text-muted w-5 text-right select-none tabular-nums flex-shrink-0">
            {position}
          </span>
        )}
        {position === undefined && !isInMatch && (
          <span className="w-5 flex-shrink-0" />
        )}
      </div>

      {/* Name + badges */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className={cn("text-sm truncate leading-none min-w-[44px]", dimmed ? "text-muted" : "text-ink")}>
          {firstName}
        </span>
        <SkillBadge level={player.skillLevel} compact />
        {player.gender && <GenderIcon gender={player.gender} size={14} />}
        {isInMatch && (
          <span className="text-[9px] text-muted bg-surface-elevated px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium leading-none">
            Playing
          </span>
        )}
        {!isInMatch && isSlotted && (
          <span className="text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium leading-none">
            Matched
          </span>
        )}
        {!isInMatch && isSelected && (
          <span className="text-[9px] text-bg bg-primary px-1.5 py-0.5 rounded-full flex-shrink-0 font-semibold leading-none">
            Selected
          </span>
        )}
      </div>

      {/* Games played + waiting time */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[10px] font-mono text-muted tabular-nums">
          {gamesPlayed ?? 0}g
        </span>
        {waitingSinceISO && (
          <ElapsedTimer
            startedAtISO={waitingSinceISO}
            className="text-[10px] font-mono tabular-nums"
            ariaLabel={(elapsed, isLong) =>
              `Waiting ${elapsed}${isLong ? " — waiting a while" : ""}`
            }
          />
        )}
      </div>

      {/* Controls */}
      {!isInMatch && (onRemove || onReturnToQueue) && (
        <div className="flex-shrink-0">
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
                  className="p-3 text-error hover:bg-error/10 active:bg-error/15 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error/40"
                  aria-label={`Confirm remove ${firstName}`}
                >
                  <Check size={11} strokeWidth={2.5} aria-hidden />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }}
                  className="p-3 text-muted hover:text-ink hover:bg-surface-elevated active:text-ink active:bg-surface-elevated rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                  aria-label="Cancel"
                >
                  <X size={11} strokeWidth={2} aria-hidden />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12, ease: EASE }}
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
              >
                {onMoveToBench && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveToBench(); }}
                    className="p-3 text-muted hover:text-ink hover:bg-surface-elevated rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                    aria-label={`Move ${firstName} to bench`}
                  >
                    <PauseCircle size={11} strokeWidth={2} aria-hidden />
                  </button>
                )}
                {onReturnToQueue && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReturnToQueue(); }}
                    className="p-3 text-muted hover:text-ink hover:bg-surface-elevated rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                    aria-label={`Return ${firstName} to queue`}
                  >
                    <PlayCircle size={11} strokeWidth={2} aria-hidden />
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }}
                    className="p-3 text-muted hover:text-error hover:bg-error/10 active:text-error active:bg-error/10 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error/40"
                    aria-label={`Remove ${firstName}`}
                  >
                    <X size={11} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
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
}: Props) {
  const waitingCount = queue.filter((e) => !e.isInMatch).length;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full flex flex-col rounded-lg border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2.5 flex-shrink-0 border-b border-border">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users size={14} strokeWidth={2} className="text-muted" aria-hidden />
            Players
            <span className="font-mono text-xs text-muted font-normal tabular-nums">
              ({waitingCount + bench.length})
            </span>
          </h2>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink hover:bg-surface-elevated px-2 py-1.5 rounded-sm border border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
            aria-label="Add players"
          >
            <Plus size={11} strokeWidth={2.5} aria-hidden />
            Add
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Queue section */}
          {queue.length > 0 && (
            <>
              <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Queue
                </span>
                <span className="font-mono text-[10px] text-muted/60 tabular-nums">
                  {waitingCount}
                </span>
              </div>
              <ul role="list" aria-label="Queue">
                <AnimatePresence initial={false}>
                  {queue.filter((e) => !e.isInMatch).map((entry, idx) => (
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
                        position={idx + 1}
                        isSlotted={slottedPlayerIds.has(entry.player.id)}
                        isSelected={selectedPlayerId === entry.player.id}
                        gamesPlayed={gamesPlayedMap.get(entry.player.id)}
                        waitingSinceISO={entry.enteredQueueAt}
                        onMoveToBench={() => onMoveToBench(entry.id)}
                        onRemove={() => onQueueRemove(entry.id)}
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
              <ul role="list" aria-label="Bench">
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
                        isSlotted={slottedPlayerIds.has(entry.player.id)}
                        isSelected={selectedPlayerId === entry.player.id}
                        gamesPlayed={gamesPlayedMap.get(entry.player.id)}
                        onReturnToQueue={() => onBenchReturnToQueue(entry.id)}
                        onRemove={() => onBenchRemove(entry.id)}
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
    </MotionConfig>
  );
}
