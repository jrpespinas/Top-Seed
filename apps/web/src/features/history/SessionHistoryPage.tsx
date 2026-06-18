import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { filterHistoryMatches, useSessionHistory } from "../../hooks/useSessionHistory.js";
import type { HistoryFilter } from "../../hooks/useSessionHistory.js";
import {
  MatchCorrectionDrawer,
  MatchHistoryList,
  SessionHistoryHeader,
} from "./MatchHistoryList.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import { Drawer } from "../../components/ui/drawer.js";

const FILTER_OPTIONS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "wins_losses", label: "Wins/Losses" },
  { value: "draws", label: "Draws" },
  { value: "unscored", label: "Unscored" },
  { value: "cancelled", label: "Cancelled" },
];

export function SessionHistoryPage() {
  const { sessionId } = useParams({ from: "/organizer/sessions/$sessionId/history" });
  const { session, matches, courts, checkIns, sessionMode } = useSessionHistory(sessionId);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [detailMatchId, setDetailMatchId] = useState<string | null>(null);
  const [correctMatchId, setCorrectMatchId] = useState<string | null>(null);
  const [correctedIds, setCorrectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => filterHistoryMatches(matches, filter), [matches, filter]);
  const detailMatch = matches.find((match) => match.id === detailMatchId) ?? null;
  const correctMatch = matches.find((match) => match.id === correctMatchId) ?? null;

  if (!session) {
    return (
      <section className="rounded-card border border-border bg-surface p-6">
        <h1 className="text-heading font-semibold">Session not found</h1>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <SessionHistoryHeader sessionId={sessionId} sessionName={session.name} />
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-control px-3 py-2 text-label ${
              filter === option.value ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <MatchHistoryList
        sessionId={sessionId}
        matches={filtered}
        courts={courts}
        checkIns={checkIns}
        sessionMode={sessionMode}
        correctedMatchIds={correctedIds}
        onSelectMatch={setDetailMatchId}
        onCorrectMatch={setCorrectMatchId}
      />
      <Drawer
        isOpen={detailMatchId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailMatchId(null);
          }
        }}
        title="Match detail"
      >
        {detailMatch ? (
          <div className="space-y-2 text-body">
            <p>Outcome: {detailMatch.outcome}</p>
            <p>
              Score: {detailMatch.teamOneScore ?? "—"} – {detailMatch.teamTwoScore ?? "—"}
            </p>
            <ul>
              {detailMatch.participants.map((participant) => (
                <li key={participant.checkInId}>
                  {displayNameForCheckIn(participant.checkInId, checkIns)}
                  {participant.ratingDelta !== undefined
                    ? ` · Δ ${participant.ratingDelta.toFixed(2)}`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Drawer>
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
          setCorrectedIds((current) => new Set([...current, matchId]));
        }}
      />
    </div>
  );
}
