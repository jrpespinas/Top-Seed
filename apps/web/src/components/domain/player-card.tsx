import { useDraggable } from "@dnd-kit/core";
import { Clock, GripVertical, MoreHorizontal, Pencil, Target, Trash2, Trophy } from "lucide-react";
import { playerDragId } from "../../features/dashboard/dnd/drag-types.js";
import { cn } from "../../lib/cn.js";
import { formatElapsedClock } from "../../lib/format/duration.js";
import { formatSkillLabel } from "../../lib/format/skill-label.js";
import { Badge } from "../ui/badge.js";
import { DropdownMenu } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { PaymentBadge, type PaymentStatus } from "./payment-badge.js";
import type { PlayerRowAction, PlayerRowCheckIn, PlayerRowPayment, PlayerRowPlayer } from "./player-row.js";
import type { SessionMode } from "./types.js";

export type PlayerCardVariant = "default" | "compact";

export interface PlayerCardProps {
  player: PlayerRowPlayer;
  checkIn?: PlayerRowCheckIn;
  checkInId?: string;
  payment?: PlayerRowPayment;
  variant?: PlayerCardVariant;
  actions?: PlayerRowAction[];
  queuePosition?: number;
  sessionMode?: SessionMode;
  draggable?: boolean;
  onOpenPlayerDetails?: () => void;
  onRemove?: () => void;
}

function queueStatusLabel(status: string, queuePosition?: number): string {
  if (status === "assigned" && queuePosition !== undefined) {
    return `Queued #${queuePosition}`;
  }
  if (status === "waiting") {
    return "Available";
  }
  if (status === "resting") {
    return "Resting";
  }
  if (status === "playing") {
    return "Playing";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusBadgeVariant(status: string): "next" | "court" | "secondary" | "attention" {
  if (status === "assigned") {
    return "next";
  }
  if (status === "playing") {
    return "court";
  }
  if (status === "waiting") {
    return "secondary";
  }
  return "secondary";
}

function showPaymentBadge(payment?: PlayerRowPayment): boolean {
  return Boolean(payment && payment.status !== "paid" && payment.status !== "waived");
}

export function PlayerCard({
  player,
  checkIn,
  checkInId,
  payment,
  variant = "default",
  actions = [],
  queuePosition,
  sessionMode = "live",
  draggable = false,
  onOpenPlayerDetails,
  onRemove,
}: PlayerCardProps) {
  const isEnded = sessionMode === "ended";
  const isCompact = variant === "compact";
  const canDrag =
    draggable &&
    Boolean(checkInId) &&
    Boolean(checkIn) &&
    (checkIn!.queueStatus === "waiting" || checkIn!.queueStatus === "resting");

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: checkInId ? playerDragId(checkInId) : "player:disabled",
    disabled: !canDrag,
    data: { displayName: player.displayName },
  });

  const overflowActions = actions.map((action) => ({
    label: action.label,
    onSelect: action.onSelect,
    destructive: action.destructive,
    disabled: isEnded,
  }));

  if (isCompact) {
    return (
      <div className="rounded-control border border-border/60 bg-surface px-2.5 py-1.5 shadow-sm">
        <span className="truncate text-caption font-medium text-foreground">{player.displayName}</span>
      </div>
    );
  }

  const gamesPlayed = checkIn?.matchesPlayed ?? 0;
  const wins = checkIn?.wins ?? 0;

  return (
    <article
      ref={setNodeRef}
      aria-grabbed={canDrag && isDragging ? true : undefined}
      className={cn(
        "group rounded-card border border-border/60 bg-surface p-3 shadow-sm",
        checkIn?.suggestionExcluded && "opacity-80",
        canDrag && isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canDrag ? (
          <IconButton
            label={`Drag ${player.displayName}`}
            size="compact"
            className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </IconButton>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <p className="truncate text-label font-semibold text-foreground">{player.displayName}</p>
              {onOpenPlayerDetails ? (
                <IconButton
                  label={`Edit ${player.displayName}`}
                  size="compact"
                  className="shrink-0 text-muted-foreground"
                  onClick={onOpenPlayerDetails}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {overflowActions.length > 0 ? (
                <DropdownMenu
                  align="end"
                  trigger={
                    <IconButton label={`Actions for ${player.displayName}`} size="compact">
                      <MoreHorizontal className="h-4 w-4" />
                    </IconButton>
                  }
                  items={overflowActions}
                />
              ) : null}
              {onRemove && !isEnded ? (
                <IconButton label={`Remove ${player.displayName}`} size="compact" onClick={onRemove}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </IconButton>
              ) : null}
            </div>
          </div>

          {checkIn ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{formatSkillLabel(checkIn.sessionSkillRating)}</Badge>
              <Badge variant={statusBadgeVariant(checkIn.queueStatus)}>
                {queueStatusLabel(checkIn.queueStatus, queuePosition)}
              </Badge>
              {showPaymentBadge(payment) && payment ? (
                <PaymentBadge
                  status={payment.status}
                  amountDue={payment.amountDue}
                  amountPaid={payment.amountPaid}
                  currency={payment.currency}
                  size="compact"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {checkIn ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {gamesPlayed} {gamesPlayed === 1 ? "game" : "games"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {wins} {wins === 1 ? "win" : "wins"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {formatElapsedClock(checkIn.checkedInAt)}
          </span>
          {checkIn.suggestionExcluded ? (
            <span className="text-warning">Skipped from suggestions</span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
