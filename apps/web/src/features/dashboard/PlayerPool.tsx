import type { PlayerCheckInPanelProps } from "../players/PlayerCheckInPanel.js";
import type { QueuePanelProps } from "../players/QueuePanel.js";
import { PlayerCheckInPanel } from "../players/PlayerCheckInPanel.js";
import { QueuePanel } from "../players/QueuePanel.js";
import type { LocalCheckIn, LocalPlayerProfile, LocalSession } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export interface PlayerPoolProps {
  session: LocalSession;
  sessionMode: SessionMode;
  playerProfiles: LocalPlayerProfile[];
  checkIns: LocalCheckIn[];
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
  queueTab,
  onCheckIn,
  onCreateWalkIn,
  onUpdateCheckIn,
  onOpenPlayerDetails,
}: PlayerPoolProps) {
  return (
    <div className="space-y-4">
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
        sessionMode={sessionMode}
        activeTab={queueTab}
        onUpdateCheckIn={onUpdateCheckIn}
        onOpenPlayerDetails={onOpenPlayerDetails}
      />
    </div>
  );
}
