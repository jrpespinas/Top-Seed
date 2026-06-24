import { Sparkles } from "lucide-react";
import { SuggestionStrip, suggestionDisplay } from "./SuggestionStrip.js";
import { QueueLaneManagement } from "./QueueLaneManagement.js";
import { Button } from "../../components/ui/button.js";
import type { useSessionDashboard } from "../../hooks/useSessionDashboard.js";

type Dashboard = ReturnType<typeof useSessionDashboard>;

export interface NextQueuePanelProps {
  dashboard: Dashboard;
  selectedLaneId: string;
  onSelectLane: (laneId: string) => void;
  layout?: "default" | "pegboard";
  dndEnabled?: boolean;
}

export function NextQueuePanel({
  dashboard,
  selectedLaneId,
  onSelectLane,
  layout = "default",
  dndEnabled = false,
}: NextQueuePanelProps) {
  const selectedLane =
    dashboard.queueLanes.find((lane) => lane.id === selectedLaneId) ??
    dashboard.queueLanes.find((lane) => lane.status !== "deleted");

  const suggestionView = dashboard.suggestion
    ? {
        explanation: dashboard.suggestion.explanation,
        ...suggestionDisplay(dashboard.suggestion.match, dashboard.checkIns),
      }
    : null;

  const isLive = dashboard.sessionMode === "live";
  const canAcceptSuggestion =
    isLive &&
    dashboard.session?.queueMode === "suggested" &&
    suggestionView !== null &&
    selectedLane !== undefined;

  return (
    <section className="flex h-full flex-col space-y-3 rounded-card border border-border bg-surface p-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      <h2 className="text-title font-semibold lg:hidden">Next queue</h2>
      <SuggestionStrip
        sessionMode={dashboard.sessionMode}
        queueMode={dashboard.session?.queueMode ?? "suggested"}
        suggestion={suggestionView}
        selectedLaneName={selectedLane?.name ?? "Next queue"}
        openCourtCount={dashboard.openCourtIds.length}
        onAccept={() => {
          if (selectedLane) {
            void dashboard.actions.acceptSuggestion(selectedLane.id);
          }
        }}
        compact={layout === "pegboard"}
      />
      <QueueLaneManagement
        sessionMode={dashboard.sessionMode}
        sessionId={dashboard.session?.id ?? ""}
        dndEnabled={dndEnabled}
        lanes={dashboard.queueLanes}
        queuedMatches={dashboard.queuedMatches}
        checkIns={dashboard.checkIns}
        courts={dashboard.courts}
        selectedLaneId={selectedLane?.id ?? ""}
        openCourtIds={dashboard.openCourtIds}
        onSelectLane={onSelectLane}
        onAddLane={() => void dashboard.actions.addQueueLane()}
        onRenameLane={(laneId, name) => void dashboard.actions.renameQueueLane(laneId, name)}
        onDeleteLane={(laneId) => void dashboard.actions.deleteQueueLane(laneId)}
        onAddEmptyMatch={(laneId) => void dashboard.actions.addEmptyQueuedMatch(laneId)}
        onRemoveQueuedMatch={(id) => void dashboard.actions.removeQueuedMatch(id)}
        onSendToCourt={(queuedMatchId, courtId) =>
          void dashboard.actions.sendQueuedMatchToCourt(queuedMatchId, courtId)
        }
        onAddPlayerToSlot={(input) => void dashboard.actions.addPlayerToQueuedSlot(input)}
        onRemovePlayerFromSlot={(input) => void dashboard.actions.removePlayerFromQueuedSlot(input)}
      />
      {layout === "pegboard" && isLive && selectedLane ? (
        <div className="mt-auto flex flex-col gap-1.5 border-t border-border/60 pt-2 sm:flex-row">
          <Button
            className="flex-1"
            variant="secondary"
            disabled={!canAcceptSuggestion}
            onClick={() => void dashboard.actions.acceptSuggestion(selectedLane.id)}
          >
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            Magic Queue
          </Button>
          <Button className="flex-1" onClick={() => void dashboard.actions.addEmptyQueuedMatch(selectedLane.id)}>
            Add Match
          </Button>
        </div>
      ) : null}
    </section>
  );
}
