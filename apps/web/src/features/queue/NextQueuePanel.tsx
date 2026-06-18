import { SuggestionStrip, suggestionDisplay } from "./SuggestionStrip.js";
import { QueueLaneManagement } from "./QueueLaneManagement.js";
import type { useSessionDashboard } from "../../hooks/useSessionDashboard.js";

type Dashboard = ReturnType<typeof useSessionDashboard>;

export interface NextQueuePanelProps {
  dashboard: Dashboard;
  selectedLaneId: string;
  onSelectLane: (laneId: string) => void;
}

export function NextQueuePanel({ dashboard, selectedLaneId, onSelectLane }: NextQueuePanelProps) {
  const selectedLane =
    dashboard.queueLanes.find((lane) => lane.id === selectedLaneId) ??
    dashboard.queueLanes.find((lane) => lane.status !== "deleted");

  const suggestionView = dashboard.suggestion
    ? {
        explanation: dashboard.suggestion.explanation,
        ...suggestionDisplay(dashboard.suggestion.match, dashboard.checkIns),
      }
    : null;

  return (
    <section className="space-y-4 rounded-card border border-border bg-surface p-4">
      <h2 className="text-title font-semibold">Next queue</h2>
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
      />
      <QueueLaneManagement
        sessionMode={dashboard.sessionMode}
        lanes={dashboard.queueLanes}
        queuedMatches={dashboard.queuedMatches}
        checkIns={dashboard.checkIns}
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
      />
    </section>
  );
}
