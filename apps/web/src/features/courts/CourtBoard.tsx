import { CourtCard, type CourtUiStatus } from "../../components/domain/court-card.js";
import { Button } from "../../components/ui/button.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import type { LocalCheckIn, LocalCourt, LocalMatch } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

const MAX_COURTS = 8;

export interface CourtBoardProps {
  courts: LocalCourt[];
  matches: LocalMatch[];
  checkIns: LocalCheckIn[];
  sessionMode: SessionMode;
  layout?: "default" | "pegboard";
  onStartMatch: (matchId: string) => void;
  onOpenMatch: (matchId: string) => void;
  onAddCourt?: () => void;
  onDeleteCourt?: (courtId: string) => void;
}

export function CourtBoard({
  courts,
  matches,
  checkIns,
  sessionMode,
  layout = "default",
  onStartMatch,
  onOpenMatch,
  onAddCourt,
  onDeleteCourt,
}: CourtBoardProps) {
  const isLive = sessionMode === "live";
  const activeCourts = courts.filter((court) => court.status !== "deleted");

  if (activeCourts.length === 0) {
    return (
      <section className="space-y-3">
        <EmptyState
          title="No courts yet"
          description="Add a court to start assigning matches."
        />
        {isLive && onAddCourt ? (
          <Button variant="secondary" onClick={onAddCourt}>
            Add court
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {layout !== "pegboard" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 lg:hidden">
          <h2 className="text-title font-semibold">Courts</h2>
          {isLive && onAddCourt ? (
            <Button
              variant="ghost"
              size="compact"
              onClick={onAddCourt}
              disabled={activeCourts.length >= MAX_COURTS}
            >
              Add court
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className={courtGridClass(activeCourts.length, layout)}>
        {activeCourts.map((court) => {
          const match = matches.find(
            (row) =>
              row.courtId === court.id &&
              (row.status === "assigned" || row.status === "in_progress"),
          );
          const uiStatus = courtUiStatus(court, match);
          const teamSlots = matchToSlots(match, checkIns);
          const primaryAction = primaryCourtAction(match, sessionMode, onStartMatch, onOpenMatch);
          const canDelete =
            isLive &&
            onDeleteCourt &&
            activeCourts.length > 1 &&
            uiStatus === "open" &&
            !match;

          return (
            <CourtCard
              key={court.id}
              court={{ id: court.id, name: court.name }}
              uiStatus={uiStatus}
              teamSlots={teamSlots}
              primaryAction={primaryAction}
              sessionMode={sessionMode}
              size="large"
              onDelete={canDelete ? () => onDeleteCourt(court.id) : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

function courtGridClass(courtCount: number, layout: CourtBoardProps["layout"]): string {
  if (layout === "pegboard") {
    return "grid grid-cols-1 gap-3";
  }

  if (courtCount <= 3) {
    return "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  }
  if (courtCount === 4) {
    return "grid gap-4 grid-cols-2";
  }
  return "grid gap-4 grid-cols-2 lg:max-h-full lg:grid-cols-3 lg:overflow-x-auto";
}

function courtUiStatus(court: LocalCourt, match?: LocalMatch): CourtUiStatus {
  if (court.status === "paused") {
    return "paused";
  }
  if (court.status === "unavailable") {
    return "unavailable";
  }
  if (!match) {
    return "open";
  }
  if (match.status === "in_progress") {
    return "inProgress";
  }
  if (match.participants.length < 4) {
    return "partiallyFilled";
  }
  return "occupied";
}

function matchToSlots(match: LocalMatch | undefined, checkIns: LocalCheckIn[]) {
  const empty = [null, null] as const;
  if (!match) {
    return { teamA: [...empty], teamB: [...empty] };
  }
  const slot = (team: "team_one" | "team_two", slotOrder: 1 | 2) => {
    const byTeam = match.participants.filter((p) => p.team === team);
    const picked = byTeam[slotOrder - 1];
    if (!picked) {
      return null;
    }
    return {
      id: picked.checkInId,
      displayName: displayNameForCheckIn(picked.checkInId, checkIns),
      slotLabel: team === "team_one" ? `A${slotOrder}` : `B${slotOrder}`,
    };
  };
  return {
    teamA: [slot("team_one", 1), slot("team_one", 2)],
    teamB: [slot("team_two", 1), slot("team_two", 2)],
  };
}

function primaryCourtAction(
  match: LocalMatch | undefined,
  sessionMode: SessionMode,
  onStartMatch: (matchId: string) => void,
  onOpenMatch: (matchId: string) => void,
) {
  if (sessionMode === "ended" || !match) {
    return undefined;
  }
  if (match.status === "assigned") {
    return { label: "Start match", onClick: () => onStartMatch(match.id) };
  }
  if (match.status === "in_progress") {
    return { label: "Finish match", onClick: () => onOpenMatch(match.id) };
  }
  return undefined;
}
