import { useState } from "react";
import { MoreHorizontal, Play } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { formatCourtUiStatus } from "../../lib/format/status-labels.js";
import { Avatar } from "../ui/avatar.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import { Card, CardBody, CardFooter, CardHeader } from "../ui/card.js";
import { Dialog, DialogContent } from "../ui/dialog.js";
import { DropdownMenu } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { StatusBadge } from "./status-badge.js";
import type { SessionMode } from "./types.js";

export type CourtUiStatus =
  | "open"
  | "partiallyFilled"
  | "occupied"
  | "inProgress"
  | "paused"
  | "unavailable";

export interface CourtSlotPlayer {
  id: string;
  displayName: string;
  slotLabel: string;
}

export interface CourtCardProps {
  court: { id: string; name: string; note?: string };
  uiStatus: CourtUiStatus;
  teamSlots: {
    teamA: (CourtSlotPlayer | null)[];
    teamB: (CourtSlotPlayer | null)[];
  };
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: { label: string; onClick: () => void }[];
  sessionMode?: SessionMode;
  size?: "default" | "large" | "compact";
  onDelete?: () => void;
}

function countFilledSlots(teamSlots: CourtCardProps["teamSlots"]): number {
  return [...teamSlots.teamA, ...teamSlots.teamB].filter(Boolean).length;
}

function isActiveCourtStatus(uiStatus: CourtUiStatus): boolean {
  return uiStatus === "occupied" || uiStatus === "partiallyFilled" || uiStatus === "inProgress";
}

function emptySlotLabel(): string {
  return "Empty";
}

function emptySlotAriaLabel(team: "A" | "B", slotOrder: number): string {
  return `Team ${team} slot ${slotOrder}, empty`;
}

function SlotPlayerToken({ displayName }: { displayName: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-control bg-muted/40 px-2 py-1.5">
      <Avatar name={displayName} size="sm" />
      <span className="min-w-0 flex-1 truncate text-caption font-medium text-foreground">{displayName}</span>
    </div>
  );
}

function EmptySlotCell({
  team,
  slotOrder,
  uiStatus,
}: {
  team: "A" | "B";
  slotOrder: number;
  uiStatus: CourtUiStatus;
}) {
  return (
    <div
      aria-label={emptySlotAriaLabel(team, slotOrder)}
      className={cn(
        "rounded-control border border-dashed border-border/80 bg-muted/30 px-2 py-2 text-center text-caption text-muted-foreground",
        uiStatus === "open" && "border-border/70",
        isActiveCourtStatus(uiStatus) && "border-court/30",
      )}
    >
      {emptySlotLabel()}
    </div>
  );
}

function TeamColumn({
  teamLabel,
  teamKey,
  slots,
  uiStatus,
}: {
  teamLabel: string;
  teamKey: "A" | "B";
  slots: (CourtSlotPlayer | null)[];
  uiStatus: CourtUiStatus;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-caption font-medium text-muted-foreground">{teamLabel}</p>
      {slots.map((player, index) => {
        const slotOrder = index + 1;
        if (player) {
          return <SlotPlayerToken key={`${teamKey}-${slotOrder}`} displayName={player.displayName} />;
        }
        return (
          <EmptySlotCell
            key={`${teamKey}-${slotOrder}`}
            team={teamKey}
            slotOrder={slotOrder}
            uiStatus={uiStatus}
          />
        );
      })}
    </div>
  );
}

export function CourtCard({
  court,
  uiStatus,
  teamSlots,
  primaryAction,
  secondaryActions = [],
  sessionMode = "live",
  size = "default",
  onDelete,
}: CourtCardProps) {
  const isEnded = sessionMode === "ended";
  const filled = countFilledSlots(teamSlots);
  const isIdleOpen = uiStatus === "open" && filled === 0;
  const isActive = isActiveCourtStatus(uiStatus);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const overflowItems = [
    ...secondaryActions.map((action) => ({
      label: action.label,
      onSelect: action.onClick,
    })),
    ...(onDelete && !isEnded
      ? [
          {
            label: `Delete ${court.name}`,
            destructive: true,
            onSelect: () => setDeleteOpen(true),
          },
        ]
      : []),
  ];

  return (
    <>
      <Card
        className={cn(
          isIdleOpen && "border-border/60 bg-surface",
          isActive && "border-court/40 bg-court/[0.04]",
          uiStatus === "inProgress" && "ring-2 ring-court/25",
          uiStatus === "unavailable" && "opacity-60",
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className={cn(
                "font-semibold text-foreground",
                size === "large" ? "text-title" : "text-label",
              )}
            >
              {court.name}
            </h3>
            {court.note ? <p className="text-caption text-muted-foreground">{court.note}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {(filled > 0 || isIdleOpen) && (
              <Badge variant="outline" className="tabular-nums">
                {filled}/4
              </Badge>
            )}
            <StatusBadge type="court" status={uiStatus} size="compact" />
            {overflowItems.length > 0 ? (
              <DropdownMenu
                align="end"
                trigger={
                  <IconButton label={`Actions for ${court.name}`} size="compact">
                    <MoreHorizontal className="h-4 w-4" />
                  </IconButton>
                }
                items={overflowItems}
              />
            ) : null}
          </div>
        </CardHeader>
        <CardBody className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <TeamColumn teamLabel="Team A" teamKey="A" slots={teamSlots.teamA} uiStatus={uiStatus} />
            <div className="flex self-stretch items-center justify-center px-0.5 pt-6" aria-hidden>
              <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground/70">
                vs
              </span>
            </div>
            <TeamColumn teamLabel="Team B" teamKey="B" slots={teamSlots.teamB} uiStatus={uiStatus} />
          </div>
          <p className="sr-only">Court status: {formatCourtUiStatus(uiStatus)}</p>
        </CardBody>
        {primaryAction && !isEnded ? (
          <CardFooter className="border-t border-border/60 pt-2">
            <Button
              size={size === "compact" ? "compact" : "default"}
              variant="primary"
              onClick={primaryAction.onClick}
              className="inline-flex w-full items-center justify-center gap-2"
              aria-label={`${primaryAction.label} on ${court.name}`}
            >
              <Play className="h-4 w-4" aria-hidden />
              {primaryAction.label}
            </Button>
          </CardFooter>
        ) : null}
      </Card>
      {onDelete ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent
            title={`Delete ${court.name}?`}
            description="Finish any active match on this court first. Completed match history is kept without this court."
          >
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  onDelete();
                  setDeleteOpen(false);
                }}
              >
                Delete court
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
