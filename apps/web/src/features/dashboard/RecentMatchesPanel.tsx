import { Link } from "@tanstack/react-router";
import { MatchCard } from "../../components/domain/match-card.js";
import { Button } from "../../components/ui/button.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import type { LocalCheckIn, LocalCourt, LocalMatch } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export function RecentMatchesPanel({
  sessionId,
  matches,
  courts,
  checkIns,
  sessionMode = "ended",
  correctedMatchIds,
  onCorrectMatch,
}: {
  sessionId: string;
  matches: LocalMatch[];
  courts: LocalCourt[];
  checkIns: LocalCheckIn[];
  sessionMode?: SessionMode;
  correctedMatchIds?: Set<string>;
  onCorrectMatch?: (matchId: string) => void;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title font-semibold">Recent matches</h2>
        <Link to="/organizer/sessions/$sessionId/history" params={{ sessionId }}>
          <Button variant="ghost" size="compact">
            View history
          </Button>
        </Link>
      </div>
      {matches.length === 0 ? (
        <EmptyState title="No completed matches yet" className="mt-3" />
      ) : (
        <ul className="mt-3 space-y-3">
          {matches.map((match) => {
            const court = courts.find((row) => row.id === match.courtId);
            const teamOne = match.participants.filter((p) => p.team === "team_one");
            const teamTwo = match.participants.filter((p) => p.team === "team_two");
            return (
              <li key={match.id}>
                {correctedMatchIds?.has(match.id) ? (
                  <p className="mb-1 text-caption text-attention">Result updated — stats refreshing</p>
                ) : null}
                <MatchCard
                  variant="history"
                  sessionMode={sessionMode}
                  match={{
                    id: match.id,
                    status: match.status,
                    courtName: court?.name,
                    outcome: match.outcome ?? undefined,
                    teamOneScore: match.teamOneScore ?? undefined,
                    teamTwoScore: match.teamTwoScore ?? undefined,
                    teams: [
                      {
                        name: "Team A",
                        players: teamOne.map((p) => displayNameForCheckIn(p.checkInId, checkIns)),
                      },
                      {
                        name: "Team B",
                        players: teamTwo.map((p) => displayNameForCheckIn(p.checkInId, checkIns)),
                      },
                    ],
                  }}
                  actions={
                    sessionMode === "live" && match.status === "completed" && onCorrectMatch
                      ? [{ label: "Correct", onClick: () => onCorrectMatch(match.id) }]
                      : []
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
