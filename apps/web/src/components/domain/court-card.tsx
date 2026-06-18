import { Play } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { formatCourtUiStatus } from "../../lib/format/status-labels.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import { Card, CardBody, CardFooter, CardHeader } from "../ui/card.js";
import { PlayerCard } from "./player-card.js";
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
  matchSummary?: string;
  sessionMode?: SessionMode;
  size?: "default" | "large" | "compact";
}

function countFilledSlots(teamSlots: CourtCardProps["teamSlots"]): number {
  return [...teamSlots.teamA, ...teamSlots.teamB].filter(Boolean).length;
}

function SlotCell({
  player,
  emptyLabel,
  uiStatus,
}: {
  player: CourtSlotPlayer | null;
  emptyLabel: string;
  uiStatus: CourtUiStatus;
}) {
  if (player) {
    return <PlayerCard variant="compact" player={{ id: player.id, displayName: player.displayName }} />;
  }
  return (
    <div
      className={cn(
        "rounded-control border border-dashed border-border/80 bg-muted/30 px-2 py-2 text-center text-caption text-muted-foreground",
        uiStatus === "open" && "border-court/30",
      )}
    >
      {emptyLabel}
    </div>
  );
}

export function CourtCard({
  court,
  uiStatus,
  teamSlots,
  primaryAction,
  secondaryActions = [],
  matchSummary,
  sessionMode = "live",
  size = "default",
}: CourtCardProps) {
  const isEnded = sessionMode === "ended";
  const filled = countFilledSlots(teamSlots);

  return (
    <Card
      className={cn(
        size === "large" && "border-court/30",
        uiStatus === "inProgress" && "ring-2 ring-court/25",
        uiStatus === "unavailable" && "opacity-60",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <h3 className="text-label font-semibold">{court.name}</h3>
          {court.note ? <p className="text-caption text-muted-foreground">{court.note}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{filled}/4</Badge>
          <StatusBadge type="court" status={uiStatus} size="compact" />
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-caption font-medium text-muted-foreground">Team A</p>
            <div className="space-y-1.5">
              {teamSlots.teamA.map((player, index) => (
                <SlotCell
                  key={`a-${index}`}
                  player={player}
                  uiStatus={uiStatus}
                  emptyLabel={uiStatus === "open" ? "Drop player here" : `Team A slot ${index + 1}`}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-caption font-medium text-muted-foreground">Team B</p>
            <div className="space-y-1.5">
              {teamSlots.teamB.map((player, index) => (
                <SlotCell
                  key={`b-${index}`}
                  player={player}
                  uiStatus={uiStatus}
                  emptyLabel={uiStatus === "open" ? "Drop player here" : `Team B slot ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="sr-only">Court status: {formatCourtUiStatus(uiStatus)}</p>
        {secondaryActions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {secondaryActions.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                size="compact"
                disabled={isEnded}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </CardBody>
      {primaryAction && !isEnded ? (
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {matchSummary ? (
            <p className="text-caption text-muted-foreground">{matchSummary}</p>
          ) : (
            <span />
          )}
          <Button
            size={size === "compact" ? "compact" : "default"}
            variant={uiStatus === "open" ? "secondary" : "primary"}
            onClick={primaryAction.onClick}
            className="inline-flex items-center gap-2"
          >
            <Play className="h-4 w-4" aria-hidden />
            {primaryAction.label}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
