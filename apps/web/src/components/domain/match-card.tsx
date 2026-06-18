import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Button } from "../ui/button.js";
import { IconButton } from "../ui/icon-button.js";
import { Badge } from "../ui/badge.js";
import { StatusBadge } from "./status-badge.js";
import { PlayerCard } from "./player-card.js";
import type { SessionMode } from "./types.js";

export type MatchCardVariant =
  | "queued"
  | "queuedIncomplete"
  | "assigned"
  | "active"
  | "completed"
  | "history";

export interface MatchTeamSlot {
  name: string;
  playerId?: string;
  displayName?: string;
}

export interface MatchTeam {
  name: string;
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
  actions?: { label: string; onClick: () => void }[];
  onRemove?: () => void;
  sessionMode?: SessionMode;
}

const outcomeLabels: Record<string, string> = {
  team_one_win: "Team A won",
  team_two_win: "Team B won",
  draw: "Draw",
  unscored: "Unscored",
  cancelled: "Cancelled",
};

function TeamColumn({
  team,
  variant,
}: {
  team: MatchTeam;
  variant: MatchCardVariant;
}) {
  const names = [...team.players];
  while (names.length < 2) {
    names.push("");
  }

  return (
    <div className="space-y-1.5">
      <p className="text-caption font-medium text-muted-foreground">{team.name}</p>
      {names.slice(0, 2).map((name, index) => {
        if (name) {
          return (
            <PlayerCard
              key={`${team.name}-${index}-${name}`}
              variant="compact"
              player={{ id: `${team.name}-${index}`, displayName: name }}
            />
          );
        }
        return (
          <div
            key={`${team.name}-empty-${index}`}
            className={cn(
              "rounded-control border border-dashed border-border/80 bg-muted/30 px-2 py-2 text-center text-caption text-muted-foreground",
              variant === "queuedIncomplete" && "border-next/40",
            )}
          >
            Drop player here
          </div>
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
  actions = [],
  onRemove,
  sessionMode = "live",
}: MatchCardProps) {
  const isEnded = sessionMode === "ended";
  const statusForBadge =
    variant === "queuedIncomplete" ? "queuedIncomplete" : match.status;
  const title = matchIndex !== undefined ? `Match #${matchIndex}` : "Match";

  return (
    <article
      className={cn(
        "rounded-card border border-border/60 bg-surface shadow-sm",
        variant === "active" && "border-court/40 ring-1 ring-court/20",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-label font-semibold text-foreground">{title}</h3>
            <StatusBadge type="match" status={statusForBadge} size="compact" />
          </div>
          {queueLaneName ? (
            <p className="text-caption text-muted-foreground">{queueLaneName}</p>
          ) : null}
          {match.courtName ? (
            <p className="text-caption text-muted-foreground">{match.courtName}</p>
          ) : null}
        </div>
        {onRemove && !isEnded ? (
          <IconButton label="Remove match" size="compact" onClick={onRemove}>
            <X className="h-4 w-4" />
          </IconButton>
        ) : null}
      </header>
      <div className="space-y-2 p-3">
        <div className="grid grid-cols-2 gap-2">
          {match.teams.map((team) => (
            <TeamColumn key={team.name} team={team} variant={variant} />
          ))}
        </div>
        {match.teams[0]?.players.length === 2 && match.teams[1]?.players.length === 2 ? (
          <Badge variant="next" className="w-fit">
            Paired 1x
          </Badge>
        ) : null}
        {match.outcome ? (
          <p className="text-caption font-medium text-foreground">
            {outcomeLabels[match.outcome] ?? match.outcome}
            {match.teamOneScore !== undefined && match.teamTwoScore !== undefined
              ? ` · ${match.teamOneScore}–${match.teamTwoScore}`
              : ""}
          </p>
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
