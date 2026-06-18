import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useSessionDashboard } from "../../hooks/useSessionDashboard.js";
import { PlayerPool } from "../dashboard/PlayerPool.js";
import { PlayerDetailDrawer } from "./PlayerDetailDrawer.js";

export function SessionPlayersPage() {
  const { sessionId } = useParams({ from: "/organizer/sessions/$sessionId/players" });
  const dashboard = useSessionDashboard(sessionId);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);

  if (!dashboard.session) {
    return (
      <section className="rounded-card border border-border bg-surface p-6">
        <h1 className="text-heading font-semibold">Session not found</h1>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/organizer/sessions/$sessionId/dashboard"
          params={{ sessionId }}
          className="text-caption text-primary"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-heading font-semibold">Players · {dashboard.session.name}</h1>
      </div>
      <PlayerPool
        session={dashboard.session}
        sessionMode={dashboard.sessionMode}
        playerProfiles={dashboard.playerProfiles}
        checkIns={dashboard.checkIns}
        onCheckIn={dashboard.actions.checkInPlayer}
        onCreateWalkIn={dashboard.actions.createAndCheckInWalkIn}
        onUpdateCheckIn={(input) =>
          dashboard.actions.updateCheckIn({
            sessionId,
            checkInId: input.checkInId,
            queueStatus: input.queueStatus as never,
            suggestionExcluded: input.suggestionExcluded,
            suggestionExcludeNote: input.suggestionExcludeNote,
          })
        }
        onOpenPlayerDetails={setSelectedCheckInId}
      />
      <PlayerDetailDrawer
        sessionId={sessionId}
        checkInId={selectedCheckInId}
        isOpen={selectedCheckInId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCheckInId(null);
          }
        }}
      />
    </div>
  );
}
