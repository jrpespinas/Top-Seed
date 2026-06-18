import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Tabs } from "../../components/ui/tabs.js";
import { useSessionDashboard } from "../../hooks/useSessionDashboard.js";
import { useSyncReviewDrawer } from "../../hooks/useSyncReviewDrawer.js";
import { SessionHeader } from "./SessionHeader.js";
import { SessionStatusBar } from "./SessionStatusBar.js";
import { PlayerPool } from "./PlayerPool.js";
import { CourtBoard } from "../courts/CourtBoard.js";
import { NextQueuePanel } from "../queue/NextQueuePanel.js";
import { PaymentSummaryPanel } from "./PaymentSummaryPanel.js";
import { RecentMatchesPanel } from "./RecentMatchesPanel.js";
import { LeaderboardPreview } from "./LeaderboardPreview.js";
import { ActiveMatchPanel } from "../matches/ActiveMatchPanel.js";
import { PlayerDetailDrawer } from "../players/PlayerDetailDrawer.js";
import { MatchCorrectionDrawer } from "../history/MatchHistoryList.js";

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

  const pool = (
    <PlayerPool
      session={dashboard.session}
      sessionMode={dashboard.sessionMode}
      playerProfiles={dashboard.playerProfiles}
      checkIns={dashboard.checkIns}
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
    />
  );

  const nextQueue = (
    <NextQueuePanel
      dashboard={dashboard}
      selectedLaneId={resolvedLaneId}
      onSelectLane={setSelectedLaneId}
    />
  );

  const more = (
    <div className="space-y-4">
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
    <div className="space-y-4 pb-24 lg:pb-4">
      <SessionHeader
        session={dashboard.session}
        courtCount={dashboard.courts.length}
        sessionMode={dashboard.sessionMode}
        connectionStatus={sync.connectionStatus}
        syncStatus={sync.syncStatus}
        pendingCount={sync.pendingCount}
        failedCount={sync.failedCount}
        blockedCount={sync.blockedCount}
        lastSyncedAt={sync.lastSyncedAt}
        onCompleteSession={dashboard.actions.completeSession}
        onRetrySync={() => void sync.retry()}
        onReviewSyncIssues={syncReview.openReview}
      />

      <SessionStatusBar
        session={dashboard.session}
        metrics={dashboard.metrics}
        onFilterWaiting={() => {
          setQueueTab("waiting");
          setMobileTab("available");
        }}
        onFilterUnpaid={() => setMobileTab("more")}
      />

      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(240px,1fr)_minmax(320px,1.4fr)_minmax(260px,1fr)]">
        <div>{pool}</div>
        <div>{courts}</div>
        <div>{nextQueue}</div>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:hidden">
        <div>{courts}</div>
        <div>{nextQueue}</div>
        <div className="md:col-span-2">{pool}</div>
      </div>

      <div className="lg:hidden">
        <Tabs
          key={mobileTab}
          items={[
            { value: "now", label: "Now", content: courts },
            { value: "next", label: "Next", content: nextQueue },
            { value: "available", label: "Available", content: pool },
            { value: "more", label: "More", content: more },
          ]}
          defaultValue={mobileTab}
        />
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        {more}
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
