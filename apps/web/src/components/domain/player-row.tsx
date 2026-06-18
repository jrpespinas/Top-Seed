import { MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { formatWaitDuration } from "../../lib/format/duration.js";
import { DropdownMenu } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { PaymentBadge, type PaymentStatus } from "./payment-badge.js";
import { StatusBadge } from "./status-badge.js";
import type { SessionMode } from "./types.js";

export type PlayerRowVariant = "queue" | "payment" | "search" | "token" | "compact";

export interface PlayerRowPlayer {
  id: string;
  displayName: string;
}

export interface PlayerRowCheckIn {
  queueStatus: string;
  sessionSkillRating: number;
  checkedInAt: string;
  matchesPlayed?: number;
  suggestionExcluded?: boolean;
}

export interface PlayerRowPayment {
  status: PaymentStatus;
  amountDue?: number;
  amountPaid?: number;
  currency?: string;
}

export interface PlayerRowAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

export interface PlayerRowProps {
  player: PlayerRowPlayer;
  checkIn?: PlayerRowCheckIn;
  payment?: PlayerRowPayment;
  variant?: PlayerRowVariant;
  actions?: PlayerRowAction[];
  isSelected?: boolean;
  sessionMode?: SessionMode;
  onOpenPlayerDetails?: () => void;
}

export function PlayerRow({
  player,
  checkIn,
  payment,
  variant = "queue",
  actions = [],
  isSelected,
  sessionMode = "live",
  onOpenPlayerDetails,
}: PlayerRowProps) {
  const isEnded = sessionMode === "ended";
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

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2",
        variant === "compact" ? "py-1.5" : "py-2",
        variant === "token" && "rounded-control border border-border bg-surface",
        isSelected && "bg-primary/5 ring-1 ring-primary/20",
        checkIn?.suggestionExcluded && "opacity-80",
      )}
    >
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="truncate text-left text-body font-medium text-foreground hover:underline"
          onClick={onOpenPlayerDetails}
          disabled={!onOpenPlayerDetails}
        >
          {player.displayName}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {checkIn && variant !== "payment" ? (
            <>
              <StatusBadge type="queue" status={checkIn.queueStatus} size="compact" />
              <span className="text-caption text-muted-foreground tabular-nums">
                Rating {checkIn.sessionSkillRating.toFixed(1)}
              </span>
              {variant === "queue" || variant === "token" ? (
                <span className="text-caption text-muted-foreground">
                  {formatWaitDuration(checkIn.checkedInAt)}
                </span>
              ) : null}
              {checkIn.matchesPlayed !== undefined ? (
                <span className="text-caption text-muted-foreground">
                  {checkIn.matchesPlayed} games
                </span>
              ) : null}
            </>
          ) : null}
          {payment && (variant === "payment" || variant === "queue") ? (
            <PaymentBadge
              status={payment.status}
              amountDue={payment.amountDue}
              amountPaid={payment.amountPaid}
              currency={payment.currency}
              size="compact"
            />
          ) : null}
          {checkIn?.suggestionExcluded ? (
            <span className="text-caption text-warning">Skipped from suggestions</span>
          ) : null}
        </div>
      </div>
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
  );
}
