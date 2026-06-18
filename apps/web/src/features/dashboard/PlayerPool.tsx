import type { PlayerCheckInPanelProps } from "../players/PlayerCheckInPanel.js";
import type { QueuePanelProps } from "../players/QueuePanel.js";
import { PlayerCheckInPanel } from "../players/PlayerCheckInPanel.js";
import { QueuePanel } from "../players/QueuePanel.js";
import type { LocalCheckIn, LocalPlayerProfile, LocalQueuedMatch, LocalSession } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export interface PlayerPoolProps {
  session: LocalSession;
  sessionMode: SessionMode;
  playerProfiles: LocalPlayerProfile[];
  checkIns: LocalCheckIn[];
  queuedMatches?: LocalQueuedMatch[];
  layout?: "default" | "pegboard";
  queueTab?: string;
  onCheckIn: PlayerCheckInPanelProps["onCheckIn"];
  onCreateWalkIn: PlayerCheckInPanelProps["onCreateWalkIn"];
  onUpdateCheckIn: QueuePanelProps["onUpdateCheckIn"];
  onOpenPlayerDetails?: (checkInId: string) => void;
}

export function PlayerPool({
  session,
  sessionMode,
  playerProfiles,
  checkIns,
  queuedMatches,
  layout = "default",
  queueTab,
  onCheckIn,
  onCreateWalkIn,
  onUpdateCheckIn,
  onOpenPlayerDetails,
}: PlayerPoolProps) {
  return (
    <div className="space-y-3">
      <PlayerCheckInPanel
        sessionMode={sessionMode}
        feeAmount={session.feeAmount}
        currency={session.currency}
        playerProfiles={playerProfiles}
        checkIns={checkIns}
        onCheckIn={onCheckIn}
        onCreateWalkIn={onCreateWalkIn}
      />
      <QueuePanel
        session={session}
        checkIns={checkIns}
        queuedMatches={queuedMatches}
        sessionMode={sessionMode}
        layout={layout}
        activeTab={queueTab}
        onUpdateCheckIn={onUpdateCheckIn}
        onOpenPlayerDetails={onOpenPlayerDetails}
      />
    </div>
  );
}
