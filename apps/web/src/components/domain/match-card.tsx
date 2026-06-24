import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { DroppableQueuedSlot } from "../../features/dashboard/dnd/DroppableQueuedSlot.js";
import { DraggableQueuedPlayer } from "../../features/dashboard/dnd/DraggableQueuedPlayer.js";
import { cn } from "../../lib/cn.js";
import { Avatar } from "../ui/avatar.js";
import { Button } from "../ui/button.js";
import { DropdownMenu } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { Badge } from "../ui/badge.js";
import { StatusBadge } from "./status-badge.js";
import type { SessionMode } from "./types.js";

export type MatchCardVariant =
  | "queued"
  | "queuedIncomplete"
  | "assigned"
  | "active"
  | "completed"
  | "history";

export interface MatchTeamSlot {
  checkInId?: string;
  name: string;
  playerId?: string;
  displayName?: string;
}

export interface MatchTeam {
  name: string;
  teamSide?: "team_one" | "team_two";
  players: string[];
  slots?: (MatchTeamSlot | null)[];
}

export interface MatchCardProps {
  match: {
    id: string;
    status: string;
    courtName?: string;
    teams: [MatchTeam, MatchTeam];
    outcome?: string;
    teamOneScore?: number;
    teamTwoScore?: number;
  };
  variant: MatchCardVariant;
  matchIndex?: number;
  queueLaneName?: string;
  showLaneName?: boolean;
  suggested?: boolean;
  actions?: { label: string; onClick: () => void }[];
  footerActions?: ReactNode;
  onRemove?: () => void;
  sessionMode?: SessionMode;
  editableSlots?: boolean;
  dndEnabled?: boolean;
  sessionId?: string;
  queuedMatchId?: string;
  onAddPlayerToSlot?: (team: "team_one" | "team_two", slotOrder: 1 | 2) => void;
  onRemovePlayerFromSlot?: (checkInId: string) => void;
}

const outcomeLabels: Record<string, string> = {
  team_one_win: "Team A won",
  team_two_win: "Team B won",
  draw: "Draw",
  unscored: "Unscored",
  cancelled: "Cancelled",
};

function slotRowsForTeam(team: MatchTeam): (MatchTeamSlot | null)[] {
  if (team.slots) {
    return team.slots;
  }
  const names = [...team.players];
  while (names.length < 2) {
    names.push("");
  }
  return names.slice(0, 2).map((name) => (name ? { name, displayName: name } : null));
}

function countFilledSlots(teams: [MatchTeam, MatchTeam]): number {
  return teams.reduce((total, team) => {
    return total + slotRowsForTeam(team).filter((slot) => slot?.displayName ?? slot?.name).length;
  }, 0);
}

function stagedStatusForBadge(variant: MatchCardVariant, matchStatus: string): string {
  if (matchStatus === "ready" || variant === "queued") {
    return "ready";
  }
  if (matchStatus === "draft" || variant === "queuedIncomplete") {
    return "draft";
  }
  return matchStatus;
}

function SlotPlayerToken({
  displayName,
  checkInId,
  editable,
  isEnded,
  onRemove,
}: {
  displayName: string;
  checkInId?: string;
  editable: boolean;
  isEnded: boolean;
  onRemove?: (checkInId: string) => void;
}) {
  const canEdit = editable && !isEnded && checkInId && onRemove;

  return (
    <div className="group flex items-center gap-1.5 rounded-control bg-muted/40 px-2 py-1.5">
      <Avatar name={displayName} size="sm" />
      <span className="min-w-0 flex-1 truncate text-caption font-medium text-foreground">{displayName}</span>
      {canEdit ? (
        <DropdownMenu
          align="end"
          trigger={
            <IconButton
              label={`Slot actions for ${displayName}`}
              size="compact"
              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </IconButton>
          }
          items={[
            {
              label: `Remove ${displayName} from match`,
              destructive: true,
              onSelect: () => onRemove!(checkInId!),
            },
          ]}
        />
      ) : null}
    </div>
  );
}

function TeamColumn({
  team,
  variant,
  editableSlots,
  dndEnabled,
  sessionId,
  queuedMatchId,
  isEnded,
  onAddPlayerToSlot,
  onRemovePlayerFromSlot,
}: {
  team: MatchTeam;
  variant: MatchCardVariant;
  editableSlots?: boolean;
  dndEnabled?: boolean;
  sessionId?: string;
  queuedMatchId?: string;
  isEnded?: boolean;
  onAddPlayerToSlot?: (team: "team_one" | "team_two", slotOrder: 1 | 2) => void;
  onRemovePlayerFromSlot?: (checkInId: string) => void;
}) {
  const teamSide = team.teamSide ?? (team.name === "Team B" ? "team_two" : "team_one");
  const slotRows = slotRowsForTeam(team);

  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-caption font-medium text-muted-foreground">{team.name}</p>
      {slotRows.map((slot, index) => {
        const slotOrder = (index + 1) as 1 | 2;
        const displayName = slot?.displayName ?? slot?.name;
        const slotDndEnabled =
          Boolean(dndEnabled && sessionId && queuedMatchId && editableSlots && !isEnded);

        if (displayName) {
          const token = (
            <SlotPlayerToken
              displayName={displayName}
              checkInId={slot?.checkInId}
              editable={Boolean(editableSlots)}
              isEnded={Boolean(isEnded)}
              onRemove={onRemovePlayerFromSlot}
            />
          );

          if (slotDndEnabled && slot?.checkInId) {
            return (
              <DroppableQueuedSlot
                key={`${team.name}-filled-${index}`}
                sessionId={sessionId}
                queuedMatchId={queuedMatchId}
                team={teamSide}
                slotOrder={slotOrder}
                enabled={slotDndEnabled}
                occupied
                occupantCheckInId={slot.checkInId}
              >
                <DraggableQueuedPlayer
                  sessionId={sessionId}
                  queuedMatchId={queuedMatchId}
                  checkInId={slot.checkInId}
                  displayName={displayName}
                  enabled={slotDndEnabled}
                >
                  {token}
                </DraggableQueuedPlayer>
              </DroppableQueuedSlot>
            );
          }

          return <div key={`${team.name}-filled-${index}`}>{token}</div>;
        }

        return (
          <DroppableQueuedSlot
            key={`${team.name}-empty-${index}`}
            sessionId={sessionId ?? ""}
            queuedMatchId={queuedMatchId ?? ""}
            team={teamSide}
            slotOrder={slotOrder}
            enabled={slotDndEnabled}
            variant={
              variant === "queuedIncomplete"
                ? "queuedIncomplete"
                : variant === "queued"
                  ? "queued"
                  : undefined
            }
          >
            {editableSlots && !isEnded && onAddPlayerToSlot ? (
              <Button
                size="compact"
                variant="ghost"
                className="h-auto min-h-0 w-full py-1"
                onClick={() => onAddPlayerToSlot(teamSide, slotOrder)}
              >
                Add player
              </Button>
            ) : (
              "Drop player here"
            )}
          </DroppableQueuedSlot>
        );
      })}
    </div>
  );
}

export function MatchCard({
  match,
  variant,
  matchIndex,
  queueLaneName,
  showLaneName = false,
  suggested = false,
  actions = [],
  footerActions,
  onRemove,
  sessionMode = "live",
  editableSlots = false,
  dndEnabled = false,
  sessionId,
  queuedMatchId,
  onAddPlayerToSlot,
  onRemovePlayerFromSlot,
}: MatchCardProps) {
  const isEnded = sessionMode === "ended";
  const isStaged = variant === "queued" || variant === "queuedIncomplete";
  const isReady = isStaged && (match.status === "ready" || variant === "queued");
  const filledCount = countFilledSlots(match.teams);
  const statusForBadge = isStaged ? stagedStatusForBadge(variant, match.status) : match.status;
  const title = matchIndex !== undefined ? `Match #${matchIndex}` : "Match";
  const headerMenuItems =
    onRemove && !isEnded
      ? [{ label: "Remove match", destructive: true, onSelect: onRemove }]
      : [];

  return (
    <article
      className={cn(
        "rounded-card border border-border/60 bg-surface shadow-sm",
        variant === "active" && "border-court/40 ring-1 ring-court/20",
        isReady && "border-next/40 bg-next/[0.03]",
        variant === "queuedIncomplete" && "border-next/25",
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-label font-semibold text-foreground">{title}</h3>
            <StatusBadge type="match" status={statusForBadge} size="compact" />
            {suggested ? (
              <Badge variant="outline" className="text-caption">
                Suggested
              </Badge>
            ) : null}
            {isStaged && !isReady ? (
              <span className="text-caption text-muted-foreground">{filledCount}/4 players</span>
            ) : null}
          </div>
          {showLaneName && queueLaneName ? (
            <p className="text-caption text-muted-foreground">{queueLaneName}</p>
          ) : null}
          {match.courtName ? (
            <p className="text-caption text-muted-foreground">{match.courtName}</p>
          ) : null}
        </div>
        {headerMenuItems.length > 0 ? (
          <DropdownMenu
            align="end"
            trigger={
              <IconButton label={`Match actions for ${title}`} size="compact">
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
            }
            items={headerMenuItems}
          />
        ) : null}
      </header>
      <div className="space-y-2 p-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <TeamColumn
            team={match.teams[0]!}
            variant={variant}
            editableSlots={editableSlots}
            dndEnabled={dndEnabled}
            sessionId={sessionId}
            queuedMatchId={queuedMatchId}
            isEnded={isEnded}
            onAddPlayerToSlot={onAddPlayerToSlot}
            onRemovePlayerFromSlot={onRemovePlayerFromSlot}
          />
          <div
            className="flex self-stretch items-center justify-center px-0.5 pt-6"
            aria-hidden
          >
            <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground/70">
              vs
            </span>
          </div>
          <TeamColumn
            team={match.teams[1]!}
            variant={variant}
            editableSlots={editableSlots}
            dndEnabled={dndEnabled}
            sessionId={sessionId}
            queuedMatchId={queuedMatchId}
            isEnded={isEnded}
            onAddPlayerToSlot={onAddPlayerToSlot}
            onRemovePlayerFromSlot={onRemovePlayerFromSlot}
          />
        </div>
        {match.outcome ? (
          <p className="text-caption font-medium text-foreground">
            {outcomeLabels[match.outcome] ?? match.outcome}
            {match.teamOneScore !== undefined && match.teamTwoScore !== undefined
              ? ` · ${match.teamOneScore}–${match.teamTwoScore}`
              : ""}
          </p>
        ) : null}
        {footerActions ? (
          <div className="border-t border-border/60 pt-2">{footerActions}</div>
        ) : null}
        {actions.length > 0 && !isEnded ? (
          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
            {actions.map((action) => (
              <Button key={action.label} size="compact" variant="secondary" onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
