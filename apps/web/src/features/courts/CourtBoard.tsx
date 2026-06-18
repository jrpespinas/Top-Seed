import { CourtCard, type CourtUiStatus } from "../../components/domain/court-card.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import type { LocalCheckIn, LocalCourt, LocalMatch } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export interface CourtBoardProps {
  courts: LocalCourt[];
  matches: LocalMatch[];
  checkIns: LocalCheckIn[];
  sessionMode: SessionMode;
  onStartMatch: (matchId: string) => void;
  onOpenMatch: (matchId: string) => void;
}

export function CourtBoard({
  courts,
  matches,
  checkIns,
  sessionMode,
  onStartMatch,
  onOpenMatch,
}: CourtBoardProps) {
  if (courts.length === 0) {
    return <EmptyState title="No courts" description="Courts are created with the session." />;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-title font-semibold">Courts</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
        {courts.map((court) => {
          const match = matches.find(
            (row) =>
              row.courtId === court.id &&
              (row.status === "assigned" || row.status === "in_progress"),
          );
          const uiStatus = courtUiStatus(court, match);
          const teamSlots = matchToSlots(match, checkIns);
          const primaryAction = primaryCourtAction(match, sessionMode, onStartMatch, onOpenMatch);

          return (
            <CourtCard
              key={court.id}
              court={{ id: court.id, name: court.name }}
              uiStatus={uiStatus}
              teamSlots={teamSlots}
              primaryAction={primaryAction}
              sessionMode={sessionMode}
              size="large"
            />
          );
        })}
      </div>
    </section>
  );
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
