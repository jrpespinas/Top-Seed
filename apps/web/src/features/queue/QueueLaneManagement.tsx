import { MatchCard } from "../../components/domain/match-card.js";
import { Button } from "../../components/ui/button.js";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import type { LocalCheckIn, LocalQueuedMatch, LocalQueueLane } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export interface QueueLaneManagementProps {
  sessionMode: SessionMode;
  lanes: LocalQueueLane[];
  queuedMatches: LocalQueuedMatch[];
  checkIns: LocalCheckIn[];
  selectedLaneId: string;
  openCourtIds: string[];
  onSelectLane: (laneId: string) => void;
  onAddLane: () => void;
  onRenameLane: (laneId: string, name: string) => void;
  onDeleteLane: (laneId: string) => void;
  onAddEmptyMatch: (laneId: string) => void;
  onRemoveQueuedMatch: (queuedMatchId: string) => void;
  onSendToCourt: (queuedMatchId: string, courtId: string) => void;
}

export function QueueLaneManagement({
  sessionMode,
  lanes,
  queuedMatches,
  checkIns,
  selectedLaneId,
  openCourtIds,
  onSelectLane,
  onAddLane,
  onRenameLane,
  onDeleteLane,
  onAddEmptyMatch,
  onRemoveQueuedMatch,
  onSendToCourt,
}: QueueLaneManagementProps) {
  const activeLanes = lanes.filter((lane) => lane.status !== "deleted");
  const isLive = sessionMode === "live";

  if (activeLanes.length === 0) {
    return <EmptyState title="No queue lanes" description="Add a lane to stage matches." />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {activeLanes.map((lane) => (
          <Button
            key={lane.id}
            variant={lane.id === selectedLaneId ? "primary" : "secondary"}
            size="compact"
            onClick={() => onSelectLane(lane.id)}
          >
            {lane.name}
          </Button>
        ))}
        {isLive ? (
          <Button variant="ghost" size="compact" onClick={onAddLane}>
            Add lane
          </Button>
        ) : null}
      </div>

      {activeLanes.map((lane) =>
        lane.id === selectedLaneId ? (
          <div key={lane.id} className="space-y-2">
            {isLive ? (
              <div className="flex flex-wrap gap-2">
                <Button size="compact" onClick={() => onAddEmptyMatch(lane.id)}>
                  Add match
                </Button>
                <Button
                  size="compact"
                  variant="ghost"
                  onClick={() => {
                    const name = window.prompt("Lane name", lane.name);
                    if (name?.trim()) {
                      onRenameLane(lane.id, name.trim());
                    }
                  }}
                >
                  Rename
                </Button>
                {activeLanes.length > 1 ? (
                  <ConfirmAction
                    triggerLabel="Delete lane"
                    title={`Delete "${lane.name}"?`}
                    description="Queued matches in this lane will be removed. Matches on courts are not affected."
                    confirmLabel="Delete lane"
                    variant="danger"
                    onConfirm={async () => onDeleteLane(lane.id)}
                  />
                ) : null}
              </div>
            ) : null}
            <LaneMatches
              lane={lane}
              queuedMatches={queuedMatches.filter(
                (queuedMatch) =>
                  queuedMatch.queueLaneId === lane.id &&
                  (queuedMatch.status === "draft" || queuedMatch.status === "ready"),
              )}
              checkIns={checkIns}
              sessionMode={sessionMode}
              openCourtIds={openCourtIds}
              onRemoveQueuedMatch={onRemoveQueuedMatch}
              onSendToCourt={onSendToCourt}
            />
          </div>
        ) : null,
      )}
    </div>
  );
}

function LaneMatches({
  lane,
  queuedMatches,
  checkIns,
  sessionMode,
  openCourtIds,
  onRemoveQueuedMatch,
  onSendToCourt,
}: {
  lane: LocalQueueLane;
  queuedMatches: LocalQueuedMatch[];
  checkIns: LocalCheckIn[];
  sessionMode: SessionMode;
  openCourtIds: string[];
  onRemoveQueuedMatch: (id: string) => void;
  onSendToCourt: (queuedMatchId: string, courtId: string) => void;
}) {
  if (queuedMatches.length === 0) {
    return <EmptyState title={`${lane.name} is empty`} description="Add a match or accept a suggestion." />;
  }

  return (
    <ul className="space-y-2">
      {queuedMatches.map((queuedMatch, index) => {
        const teamOne = queuedMatch.participants.filter((p) => p.team === "team_one");
        const teamTwo = queuedMatch.participants.filter((p) => p.team === "team_two");
        const variant =
          queuedMatch.status === "ready"
            ? "queued"
            : queuedMatch.participants.length < 4
              ? "queuedIncomplete"
              : "queued";
        const actions =
          sessionMode === "live"
            ? [
                ...(queuedMatch.status === "ready" && openCourtIds.length > 0
                  ? [
                      {
                        label: "Send to court",
                        onClick: () => onSendToCourt(queuedMatch.id, openCourtIds[0]!),
                      },
                    ]
                  : []),
                {
                  label: "Remove",
                  onClick: () => onRemoveQueuedMatch(queuedMatch.id),
                },
              ]
            : [];

        return (
          <li key={queuedMatch.id}>
            <MatchCard
              variant={variant}
              matchIndex={index + 1}
              queueLaneName={lane.name}
              sessionMode={sessionMode}
              onRemove={
                sessionMode === "live"
                  ? () => onRemoveQueuedMatch(queuedMatch.id)
                  : undefined
              }
              match={{
                id: queuedMatch.id,
                status: queuedMatch.status,
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
              actions={actions}
            />
            {queuedMatch.participants.length < 4 ? (
              <p className="mt-1 text-caption text-muted-foreground">
                Needs {4 - queuedMatch.participants.length} player(s)
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
