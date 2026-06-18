import { MatchCard } from "../../components/domain/match-card.js";
import { Button } from "../../components/ui/button.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import type { LocalCheckIn } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export interface SuggestionStripProps {
  sessionMode: SessionMode;
  queueMode: "suggested" | "manual";
  suggestion: {
    explanation: string;
    teamOneNames: string[];
    teamTwoNames: string[];
  } | null;
  selectedLaneName: string;
  openCourtCount: number;
  onAccept: () => void;
}

export function SuggestionStrip({
  sessionMode,
  queueMode,
  suggestion,
  selectedLaneName,
  openCourtCount,
  onAccept,
}: SuggestionStripProps) {
  if (sessionMode === "ended") {
    return null;
  }

  if (queueMode === "manual") {
    return (
      <p className="rounded-card border border-border bg-muted/40 px-4 py-3 text-body text-muted-foreground">
        Manual queue mode — build matches in Next lanes.
      </p>
    );
  }

  if (!suggestion) {
    return (
      <EmptyState
        title="Need four waiting players"
        description="Check in more players or clear skips to get a suggested doubles match."
      />
    );
  }

  return (
    <section
      aria-label="Suggested next match"
      className="rounded-card border border-next/30 bg-next/5 p-4"
    >
      <h3 className="text-title font-semibold">Suggested next match</h3>
      <p className="mt-1 text-caption text-muted-foreground">{suggestion.explanation}</p>
      <MatchCard
        variant="queued"
        match={{
          id: "suggestion-preview",
          status: "suggested",
          teams: [
            { name: "Team A", players: suggestion.teamOneNames },
            { name: "Team B", players: suggestion.teamTwoNames },
          ],
        }}
      />
      {openCourtCount === 0 ? (
        <p className="mt-2 text-caption text-warning">
          All courts busy — you can still add to Next queue.
        </p>
      ) : null}
      <Button className="mt-3" variant="primary" onClick={onAccept}>
        Add to {selectedLaneName}
      </Button>
    </section>
  );
}

export function suggestionDisplay(
  suggestion: NonNullable<import("@top-seed/domain").MatchSuggestion>,
  checkIns: LocalCheckIn[],
) {
  const name = (profileId: string) => {
    const checkIn = checkIns.find((row) => row.playerProfileId === profileId);
    return checkIn?.playerDisplayName ?? displayNameForCheckIn(profileId, checkIns);
  };
  return {
    teamOneNames: suggestion.teamOne.playerProfileIds.map(name),
    teamTwoNames: suggestion.teamTwo.playerProfileIds.map(name),
  };
}
