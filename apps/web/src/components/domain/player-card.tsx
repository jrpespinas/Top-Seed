import { Clock, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { formatWaitDuration } from "../../lib/format/duration.js";
import { formatSkillLabel } from "../../lib/format/skill-label.js";
import { Avatar } from "../ui/avatar.js";
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
  payment?: PlayerRowPayment;
  variant?: PlayerCardVariant;
  actions?: PlayerRowAction[];
  queuePosition?: number;
  sessionMode?: SessionMode;
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

export function PlayerCard({
  player,
  checkIn,
  payment,
  variant = "default",
  actions = [],
  queuePosition,
  sessionMode = "live",
  onOpenPlayerDetails,
  onRemove,
}: PlayerCardProps) {
  const isEnded = sessionMode === "ended";
  const isCompact = variant === "compact";

  const menuActions = [
    ...(onOpenPlayerDetails
      ? [{ label: "View details", onSelect: onOpenPlayerDetails }]
      : []),
    ...actions.map((action) => ({
      label: action.label,
      onSelect: action.onSelect,
      destructive: action.destructive,
      disabled: isEnded,
    })),
  ];

  if (isCompact) {
    return (
      <div className="rounded-control border border-border/60 bg-surface px-2 py-1.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Avatar name={player.displayName} size="sm" />
          <span className="truncate text-caption font-medium text-foreground">{player.displayName}</span>
        </div>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "rounded-card border border-border/60 bg-surface p-2.5 shadow-sm",
        checkIn?.suggestionExcluded && "opacity-80",
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar name={player.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <button
                type="button"
                className="truncate text-left text-label font-semibold text-foreground hover:underline"
                onClick={onOpenPlayerDetails}
                disabled={!onOpenPlayerDetails}
              >
                {player.displayName}
              </button>
              {checkIn ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{formatSkillLabel(checkIn.sessionSkillRating)}</Badge>
                  <Badge variant={statusBadgeVariant(checkIn.queueStatus)}>
                    {queueStatusLabel(checkIn.queueStatus, queuePosition)}
                  </Badge>
                  {payment ? (
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
            <div className="flex shrink-0 items-center gap-1">
              {onRemove && !isEnded ? (
                <IconButton label={`Remove ${player.displayName}`} size="compact" onClick={onRemove}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </IconButton>
              ) : null}
              {menuActions.length > 0 ? (
                <DropdownMenu
                  trigger={
                    <IconButton label={`Actions for ${player.displayName}`} size="compact">
                      <MoreHorizontal className="h-4 w-4" />
                    </IconButton>
                  }
                  items={menuActions}
                />
              ) : null}
            </div>
          </div>
          {checkIn ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              <span>{checkIn.matchesPlayed ?? 0} games</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {formatWaitDuration(checkIn.checkedInAt)}
              </span>
              {checkIn.suggestionExcluded ? (
                <span className="text-warning">Skipped from suggestions</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
