import { cn } from "../../lib/cn.js";
import { formatCourtUiStatus } from "../../lib/format/status-labels.js";
import { Button } from "../ui/button.js";
import { Card, CardBody, CardHeader } from "../ui/card.js";
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
}

function SlotCell({ player, emptyLabel }: { player: CourtSlotPlayer | null; emptyLabel: string }) {
  return (
    <div className="rounded-control border border-dashed border-border bg-muted/30 px-2 py-2 text-caption">
      {player ? (
        <span className="font-medium text-foreground">{player.displayName}</span>
      ) : (
        <span className="text-muted-foreground">{emptyLabel}</span>
      )}
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
}: CourtCardProps) {
  const isEnded = sessionMode === "ended";

  return (
    <Card
      className={cn(
        size === "large" && "border-court/40",
        uiStatus === "inProgress" && "ring-2 ring-court/30",
        uiStatus === "unavailable" && "opacity-60",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <h3 className="text-title font-semibold">{court.name}</h3>
          {court.note ? <p className="text-caption text-muted-foreground">{court.note}</p> : null}
        </div>
        <StatusBadge type="court" status={uiStatus} size="compact" />
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-caption font-medium text-muted-foreground">Team A</p>
            <div className="space-y-2">
              {teamSlots.teamA.map((player, index) => (
                <SlotCell
                  key={`a-${index}`}
                  player={player}
                  emptyLabel={`Team A player ${index + 1} empty`}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-caption font-medium text-muted-foreground">Team B</p>
            <div className="space-y-2">
              {teamSlots.teamB.map((player, index) => (
                <SlotCell
                  key={`b-${index}`}
                  player={player}
                  emptyLabel={`Team B player ${index + 1} empty`}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="sr-only">Court status: {formatCourtUiStatus(uiStatus)}</p>
        <div className="flex flex-wrap gap-2">
          {primaryAction && !isEnded ? (
            <Button
              size={size === "compact" ? "compact" : "default"}
              variant={uiStatus === "open" ? "secondary" : "primary"}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          ) : null}
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
      </CardBody>
    </Card>
  );
}
