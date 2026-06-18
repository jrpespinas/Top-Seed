import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useParams } from "@tanstack/react-router";
import { Tabs } from "../../components/ui/tabs.js";
import { useSessionDashboard } from "../../hooks/useSessionDashboard.js";
import { useSyncReviewDrawer } from "../../hooks/useSyncReviewDrawer.js";
import { SessionWorkspaceBar } from "./SessionWorkspaceBar.js";
import { SessionStatusBar } from "./SessionStatusBar.js";
import { AttentionRail } from "./AttentionRail.js";
import { PegboardLayout } from "./PegboardLayout.js";
import { SupportingStrip } from "./SupportingStrip.js";
import { PlayerPool } from "./PlayerPool.js";
import { CourtBoard } from "../courts/CourtBoard.js";
import { NextQueuePanel } from "../queue/NextQueuePanel.js";
import { PaymentSummaryPanel } from "./PaymentSummaryPanel.js";
import { RecentMatchesPanel } from "./RecentMatchesPanel.js";
import { LeaderboardPreview } from "./LeaderboardPreview.js";
import { ActiveMatchPanel } from "../matches/ActiveMatchPanel.js";
import { PlayerDetailDrawer } from "../players/PlayerDetailDrawer.js";
import { MatchCorrectionDrawer } from "../history/MatchHistoryList.js";
import { Button } from "../../components/ui/button.js";
import { IconButton } from "../../components/ui/icon-button.js";

export function SessionDashboardPage() {
  const { sessionId } = useParams({ from: "/organizer/sessions/$sessionId/dashboard" });
  const dashboard = useSessionDashboard(sessionId);
  const syncReview = useSyncReviewDrawer(sessionId);
  const sync = syncReview.sync;
  const [mobileTab, setMobileTab] = useState("now");
  const [queueTab, setQueueTab] = useState("waiting");
  const [selectedLaneId, setSelectedLaneId] = useState<string>("");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);
  const [correctMatchId, setCorrectMatchId] = useState<string | null>(null);
  const [correctedMatchIds, setCorrectedMatchIds] = useState<Set<string>>(new Set());

  const resolvedLaneId = useMemo(() => {
    if (selectedLaneId) {
      return selectedLaneId;
    }
    const firstLane = dashboard.queueLanes.find((lane) => lane.status !== "deleted");
    return firstLane?.id ?? "";
  }, [dashboard.queueLanes, selectedLaneId]);

  const activeMatch = dashboard.matches.find((match) => match.id === activeMatchId) ?? null;

  if (!dashboard.session) {
    return (
      <section className="rounded-card border border-border bg-surface p-6">
        <h1 className="text-heading font-semibold">Session not found</h1>
        <p className="mt-2 text-body text-muted-foreground">
          This session is not in local storage yet.
        </p>
      </section>
    );
  }

  const poolForMobile = (
    <PlayerPool
      session={dashboard.session}
      sessionMode={dashboard.sessionMode}
      playerProfiles={dashboard.playerProfiles}
      checkIns={dashboard.checkIns}
      queuedMatches={dashboard.queuedMatches}
      queueTab={queueTab}
      onCheckIn={dashboard.actions.checkInPlayer}
      onCreateWalkIn={dashboard.actions.createAndCheckInWalkIn}
      onUpdateCheckIn={(input) =>
        dashboard.actions.updateCheckIn({
          sessionId,
          checkInId: input.checkInId,
          queueStatus: input.queueStatus as
            | "waiting"
            | "assigned"
            | "playing"
            | "resting"
            | "done"
            | "removed"
            | undefined,
          suggestionExcluded: input.suggestionExcluded,
          suggestionExcludeNote: input.suggestionExcludeNote,
        })
      }
      onOpenPlayerDetails={setSelectedCheckInId}
    />
  );

  const poolForPegboard = (
    <PlayerPool
      session={dashboard.session}
      sessionMode={dashboard.sessionMode}
      playerProfiles={dashboard.playerProfiles}
      checkIns={dashboard.checkIns}
      queuedMatches={dashboard.queuedMatches}
      layout="pegboard"
      queueTab={queueTab}
      onCheckIn={dashboard.actions.checkInPlayer}
      onCreateWalkIn={dashboard.actions.createAndCheckInWalkIn}
      onUpdateCheckIn={(input) =>
        dashboard.actions.updateCheckIn({
          sessionId,
          checkInId: input.checkInId,
          queueStatus: input.queueStatus as
            | "waiting"
            | "assigned"
            | "playing"
            | "resting"
            | "done"
            | "removed"
            | undefined,
          suggestionExcluded: input.suggestionExcluded,
          suggestionExcludeNote: input.suggestionExcludeNote,
        })
      }
      onOpenPlayerDetails={setSelectedCheckInId}
    />
  );

  const correctMatch =
    dashboard.matches.find((match) => match.id === correctMatchId) ?? null;

  const courts = (
    <CourtBoard
      courts={dashboard.courts}
      matches={dashboard.matches}
      checkIns={dashboard.checkIns}
      sessionMode={dashboard.sessionMode}
      onStartMatch={dashboard.actions.startMatch}
      onOpenMatch={setActiveMatchId}
      onAddCourt={() => void dashboard.actions.addCourt()}
      onDeleteCourt={(courtId) => void dashboard.actions.deleteCourt(courtId)}
    />
  );

  const courtsPegboard = (
    <CourtBoard
      courts={dashboard.courts}
      matches={dashboard.matches}
      checkIns={dashboard.checkIns}
      sessionMode={dashboard.sessionMode}
      layout="pegboard"
      onStartMatch={dashboard.actions.startMatch}
      onOpenMatch={setActiveMatchId}
      onAddCourt={() => void dashboard.actions.addCourt()}
      onDeleteCourt={(courtId) => void dashboard.actions.deleteCourt(courtId)}
    />
  );

  const nextQueueMobile = (
    <NextQueuePanel
      dashboard={dashboard}
      selectedLaneId={resolvedLaneId}
      onSelectLane={setSelectedLaneId}
    />
  );

  const nextQueue = (
    <NextQueuePanel
      dashboard={dashboard}
      selectedLaneId={resolvedLaneId}
      onSelectLane={setSelectedLaneId}
      layout="pegboard"
    />
  );

  const checkedInCount = dashboard.checkIns.filter((c) => c.queueStatus !== "removed").length;
  const queuedMatchCount = dashboard.queuedMatches.filter(
    (m) => m.status === "draft" || m.status === "ready",
  ).length;
  const activeCourtCount = dashboard.courts.filter((c) => c.status !== "deleted").length;

  const focusPlayerCheckIn = () => {
    document.getElementById("player-check-in-search")?.focus();
  };

  const more = (
    <div className="space-y-3">
      <SessionStatusBar
        session={dashboard.session}
        metrics={dashboard.metrics}
        onFilterWaiting={() => {
          setQueueTab("waiting");
          setMobileTab("available");
        }}
        onFilterUnpaid={() => setMobileTab("more")}
      />
      <PaymentSummaryPanel
        session={dashboard.session}
        summary={dashboard.paymentSummary}
        checkIns={dashboard.checkIns}
        sessionId={sessionId}
        sessionMode={dashboard.sessionMode}
      />
      <RecentMatchesPanel
        sessionId={sessionId}
        matches={dashboard.recentMatches}
        courts={dashboard.courts}
        checkIns={dashboard.checkIns}
        sessionMode={dashboard.sessionMode}
        correctedMatchIds={correctedMatchIds}
        onCorrectMatch={setCorrectMatchId}
      />
      <LeaderboardPreview sessionId={sessionId} />
    </div>
  );

  return (
    <div className="space-y-3 pb-24 lg:pb-4">
      <SessionWorkspaceBar
        session={dashboard.session}
        courtCount={activeCourtCount}
        sessionMode={dashboard.sessionMode}
        syncStatus={sync.syncStatus}
        pendingCount={sync.pendingCount}
        blockedCount={sync.blockedCount}
        lastSyncedAt={sync.lastSyncedAt}
        activeView="dashboard"
        sticky
      />

      <div className="hidden lg:block">
        <AttentionRail
          sessionId={sessionId}
          unpaidCount={dashboard.metrics.unpaid}
          connectionStatus={sync.connectionStatus}
          syncStatus={sync.syncStatus}
          pendingCount={sync.pendingCount}
          failedCount={sync.failedCount}
          blockedCount={sync.blockedCount}
          lastSyncedAt={sync.lastSyncedAt}
          onRetrySync={() => void sync.retry()}
          onReviewSyncIssues={syncReview.openReview}
        />
      </div>

      <div className="hidden lg:block">
        <PegboardLayout
          playerList={poolForPegboard}
          upcomingMatches={nextQueue}
          courts={courtsPegboard}
          playerListCount={`${checkedInCount} total`}
          upcomingCount={`${queuedMatchCount} queued`}
          courtsCount={`${activeCourtCount} active`}
          playerListAction={
            dashboard.sessionMode === "live" ? (
              <IconButton label="Check in player" size="compact" onClick={focusPlayerCheckIn}>
                <Plus className="h-4 w-4" />
              </IconButton>
            ) : null
          }
          upcomingAction={
            dashboard.sessionMode === "live" && resolvedLaneId ? (
              <IconButton
                label="Add match"
                size="compact"
                onClick={() => void dashboard.actions.addEmptyQueuedMatch(resolvedLaneId)}
              >
                <Plus className="h-4 w-4" />
              </IconButton>
            ) : null
          }
          courtsAction={
            dashboard.sessionMode === "live" ? (
              <Button variant="ghost" size="compact" onClick={() => void dashboard.actions.addCourt()}>
                Add court
              </Button>
            ) : null
          }
        />
      </div>

      <div className="hidden lg:block">
        <SupportingStrip
          session={dashboard.session}
          collected={dashboard.metrics.collected}
          expectedTotal={dashboard.paymentSummary?.expectedTotal ?? 0}
          recentMatches={dashboard.recentMatches}
          checkIns={dashboard.checkIns}
          courts={dashboard.courts}
          sessionId={sessionId}
          sessionMode={dashboard.sessionMode}
          checkedInCount={dashboard.metrics.checkedIn}
          onCompleteSession={dashboard.actions.completeSession}
        />
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:hidden">
        <div>{poolForMobile}</div>
        <div>{nextQueueMobile}</div>
        <div className="md:col-span-2">{courts}</div>
      </div>

      <div className="lg:hidden">
        <Tabs
          key={mobileTab}
          items={[
            { value: "now", label: "Now", content: courts },
            { value: "next", label: "Next", content: nextQueueMobile },
            { value: "available", label: "Available", content: poolForMobile },
            { value: "more", label: "More", content: more },
          ]}
          defaultValue={mobileTab}
        />
      </div>

      <ActiveMatchPanel
        open={activeMatchId !== null}
        session={dashboard.session}
        match={activeMatch}
        onClose={() => setActiveMatchId(null)}
        onComplete={(result) => dashboard.actions.completeMatch(activeMatch!.id, result)}
        onCancel={() => dashboard.actions.cancelMatch(activeMatch!.id)}
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
      <MatchCorrectionDrawer
        sessionId={sessionId}
        match={correctMatch}
        isOpen={correctMatchId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCorrectMatchId(null);
          }
        }}
        onCorrected={(matchId) => {
          setCorrectedMatchIds((current) => new Set([...current, matchId]));
        }}
      />
      {syncReview.panel}
    </div>
  );
}
