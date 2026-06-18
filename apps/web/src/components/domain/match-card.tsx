import { cn } from "../../lib/cn.js";
import { Button } from "../ui/button.js";
import { Card, CardBody, CardHeader } from "../ui/card.js";
import { StatusBadge } from "./status-badge.js";
import type { SessionMode } from "./types.js";

export type MatchCardVariant =
  | "queued"
  | "queuedIncomplete"
  | "assigned"
  | "active"
  | "completed"
  | "history";

export interface MatchTeam {
  name: string;
  players: string[];
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
  queueLaneName?: string;
  actions?: { label: string; onClick: () => void }[];
  sessionMode?: SessionMode;
}

const outcomeLabels: Record<string, string> = {
  team_one_win: "Team A won",
  team_two_win: "Team B won",
  draw: "Draw",
  unscored: "Unscored",
  cancelled: "Cancelled",
};

export function MatchCard({
  match,
  variant,
  queueLaneName,
  actions = [],
  sessionMode = "live",
}: MatchCardProps) {
  const isEnded = sessionMode === "ended";
  const statusForBadge =
    variant === "queuedIncomplete" ? "queuedIncomplete" : match.status;

  return (
    <Card className={cn(variant === "active" && "border-court/40 ring-1 ring-court/20")}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          {queueLaneName ? (
            <p className="text-caption font-medium text-next">{queueLaneName}</p>
          ) : null}
          {match.courtName ? (
            <p className="text-caption text-muted-foreground">{match.courtName}</p>
          ) : null}
        </div>
        <StatusBadge type="match" status={statusForBadge} size="compact" />
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {match.teams.map((team) => (
            <div key={team.name}>
              <p className="text-caption font-medium text-muted-foreground">{team.name}</p>
              <ul className="mt-1 space-y-0.5 text-body">
                {team.players.length > 0 ? (
                  team.players.map((player) => <li key={player}>{player}</li>)
                ) : (
                  <li className="text-caption text-muted-foreground">Empty slot</li>
                )}
              </ul>
            </div>
          ))}
        </div>
        {match.outcome ? (
          <p className="text-caption font-medium text-foreground">
            {outcomeLabels[match.outcome] ?? match.outcome}
            {match.teamOneScore !== undefined && match.teamTwoScore !== undefined
              ? ` · ${match.teamOneScore}–${match.teamTwoScore}`
              : ""}
          </p>
        ) : null}
        {actions.length > 0 && !isEnded ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button key={action.label} size="compact" variant="secondary" onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
