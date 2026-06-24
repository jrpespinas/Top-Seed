import { useMemo, useState } from "react";
import { MatchCard } from "../../components/domain/match-card.js";
import { Button } from "../../components/ui/button.js";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import { participantAtSlot } from "../../lib/queued-match-participants.js";
import type { LocalCheckIn, LocalCourt, LocalQueuedMatch, LocalQueueLane } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";
import type { QueuedMatchSlotOrder, QueuedMatchTeam } from "../../lib/queued-match-participants.js";
import { AddPlayerToSlotDialog } from "./AddPlayerToSlotDialog.js";
import { SendToCourtAction } from "./SendToCourtAction.js";

export interface QueueLaneManagementProps {
  sessionMode: SessionMode;
  sessionId: string;
  dndEnabled?: boolean;
  lanes: LocalQueueLane[];
  queuedMatches: LocalQueuedMatch[];
  checkIns: LocalCheckIn[];
  courts: LocalCourt[];
  selectedLaneId: string;
  openCourtIds: string[];
  onSelectLane: (laneId: string) => void;
  onAddLane: () => void;
  onRenameLane: (laneId: string, name: string) => void;
  onDeleteLane: (laneId: string) => void;
  onAddEmptyMatch: (laneId: string) => void;
  onRemoveQueuedMatch: (queuedMatchId: string) => void;
  onSendToCourt: (queuedMatchId: string, courtId: string) => void;
  onAddPlayerToSlot: (input: {
    queuedMatchId: string;
    checkInId: string;
    team: QueuedMatchTeam;
    slotOrder: QueuedMatchSlotOrder;
  }) => void;
  onRemovePlayerFromSlot: (input: { queuedMatchId: string; checkInId: string }) => void;
}

interface PendingSlot {
  queuedMatchId: string;
  team: QueuedMatchTeam;
  slotOrder: QueuedMatchSlotOrder;
}

export function QueueLaneManagement({
  sessionMode,
  sessionId,
  dndEnabled = false,
  lanes,
  queuedMatches,
  checkIns,
  courts,
  selectedLaneId,
  openCourtIds,
  onSelectLane,
  onAddLane,
  onRenameLane,
  onDeleteLane,
  onAddEmptyMatch,
  onRemoveQueuedMatch,
  onSendToCourt,
  onAddPlayerToSlot,
  onRemovePlayerFromSlot,
}: QueueLaneManagementProps) {
  const activeLanes = lanes.filter((lane) => lane.status !== "deleted");
  const isLive = sessionMode === "live";
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);

  const openCourts = useMemo(
    () =>
      openCourtIds
        .map((courtId) => courts.find((court) => court.id === courtId))
        .filter((court): court is LocalCourt => court !== undefined),
    [courts, openCourtIds],
  );

  const excludedCheckInIds = useMemo(() => {
    if (!pendingSlot) {
      return new Set<string>();
    }
    const match = queuedMatches.find((row) => row.id === pendingSlot.queuedMatchId);
    return new Set(match?.participants.map((p) => p.checkInId) ?? []);
  }, [pendingSlot, queuedMatches]);

  if (activeLanes.length === 0) {
    return <EmptyState title="No queue lanes" description="Add a lane to stage matches." />;
  }

  return (
    <>
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
                sessionId={sessionId}
                dndEnabled={dndEnabled}
                queuedMatches={queuedMatches.filter(
                  (queuedMatch) =>
                    queuedMatch.queueLaneId === lane.id &&
                    (queuedMatch.status === "draft" || queuedMatch.status === "ready"),
                )}
                checkIns={checkIns}
                sessionMode={sessionMode}
                openCourts={openCourts}
                onRemoveQueuedMatch={onRemoveQueuedMatch}
                onSendToCourt={onSendToCourt}
                onRequestAddPlayer={(queuedMatchId, team, slotOrder) =>
                  setPendingSlot({ queuedMatchId, team, slotOrder })
                }
                onRemovePlayerFromSlot={onRemovePlayerFromSlot}
              />
            </div>
          ) : null,
        )}
      </div>
      <AddPlayerToSlotDialog
        isOpen={pendingSlot !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSlot(null);
          }
        }}
        team={pendingSlot?.team ?? "team_one"}
        slotOrder={pendingSlot?.slotOrder ?? 1}
        checkIns={checkIns}
        excludedCheckInIds={excludedCheckInIds}
        onSelect={(checkInId) => {
          if (!pendingSlot) {
            return;
          }
          onAddPlayerToSlot({
            queuedMatchId: pendingSlot.queuedMatchId,
            checkInId,
            team: pendingSlot.team,
            slotOrder: pendingSlot.slotOrder,
          });
          setPendingSlot(null);
        }}
      />
    </>
  );
}

function buildTeamSlots(
  queuedMatch: LocalQueuedMatch,
  checkIns: LocalCheckIn[],
  team: QueuedMatchTeam,
) {
  return ([1, 2] as const).map((slotOrder) => {
    const participant = participantAtSlot(queuedMatch.participants, team, slotOrder);
    if (!participant) {
      return null;
    }
    return {
      checkInId: participant.checkInId,
      name: displayNameForCheckIn(participant.checkInId, checkIns),
      displayName: displayNameForCheckIn(participant.checkInId, checkIns),
    };
  });
}

function LaneMatches({
  lane,
  sessionId,
  dndEnabled,
  queuedMatches,
  checkIns,
  sessionMode,
  openCourts,
  onRemoveQueuedMatch,
  onSendToCourt,
  onRequestAddPlayer,
  onRemovePlayerFromSlot,
}: {
  lane: LocalQueueLane;
  sessionId: string;
  dndEnabled: boolean;
  queuedMatches: LocalQueuedMatch[];
  checkIns: LocalCheckIn[];
  sessionMode: SessionMode;
  openCourts: LocalCourt[];
  onRemoveQueuedMatch: (id: string) => void;
  onSendToCourt: (queuedMatchId: string, courtId: string) => void;
  onRequestAddPlayer: (
    queuedMatchId: string,
    team: QueuedMatchTeam,
    slotOrder: QueuedMatchSlotOrder,
  ) => void;
  onRemovePlayerFromSlot: (input: { queuedMatchId: string; checkInId: string }) => void;
}) {
  if (queuedMatches.length === 0) {
    return <EmptyState title={`${lane.name} is empty`} description="Add a match or accept a suggestion." />;
  }

  const isLive = sessionMode === "live";

  return (
    <ul className="space-y-2">
      {queuedMatches.map((queuedMatch, index) => {
        const variant =
          queuedMatch.status === "ready"
            ? "queued"
            : queuedMatch.participants.length < 4
              ? "queuedIncomplete"
              : "queued";
        const canEditSlots =
          isLive && (queuedMatch.status === "draft" || queuedMatch.status === "ready");

        return (
          <li key={queuedMatch.id}>
            <MatchCard
              variant={variant}
              matchIndex={index + 1}
              suggested={queuedMatch.createdFrom === "suggestion"}
              sessionMode={sessionMode}
              sessionId={sessionId}
              queuedMatchId={queuedMatch.id}
              dndEnabled={dndEnabled}
              editableSlots={canEditSlots}
              onAddPlayerToSlot={(team, slotOrder) =>
                onRequestAddPlayer(queuedMatch.id, team, slotOrder)
              }
              onRemovePlayerFromSlot={(checkInId) =>
                onRemovePlayerFromSlot({ queuedMatchId: queuedMatch.id, checkInId })
              }
              onRemove={isLive ? () => onRemoveQueuedMatch(queuedMatch.id) : undefined}
              match={{
                id: queuedMatch.id,
                status: queuedMatch.status,
                teams: [
                  {
                    name: "Team A",
                    teamSide: "team_one",
                    players: [],
                    slots: buildTeamSlots(queuedMatch, checkIns, "team_one"),
                  },
                  {
                    name: "Team B",
                    teamSide: "team_two",
                    players: [],
                    slots: buildTeamSlots(queuedMatch, checkIns, "team_two"),
                  },
                ],
              }}
              footerActions={
                isLive && queuedMatch.status === "ready" && openCourts.length > 0 ? (
                  <SendToCourtAction
                    fullWidth
                    matchIndex={index + 1}
                    openCourts={openCourts}
                    onSend={(courtId) => onSendToCourt(queuedMatch.id, courtId)}
                  />
                ) : undefined
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
