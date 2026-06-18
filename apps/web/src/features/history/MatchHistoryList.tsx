import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MatchCard } from "../../components/domain/match-card.js";
import { Button } from "../../components/ui/button.js";
import { Drawer } from "../../components/ui/drawer.js";
import { FormField } from "../../components/ui/form-field.js";
import { Select } from "../../components/ui/select.js";
import { correctMatchResultLocal } from "../../mutations/correctMatchResult.js";
import type { LocalMatch } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

const OUTCOME_OPTIONS = [
  { value: "team_one_win", label: "Team A won" },
  { value: "team_two_win", label: "Team B won" },
  { value: "draw", label: "Draw" },
  { value: "unscored", label: "Unscored" },
];

export function MatchCorrectionDrawer({
  sessionId,
  match,
  isOpen,
  onOpenChange,
  onCorrected,
}: {
  sessionId: string;
  match: LocalMatch | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCorrected?: (matchId: string) => void;
}) {
  const [outcome, setOutcome] = useState("team_one_win");
  const [teamOneScore, setTeamOneScore] = useState("21");
  const [teamTwoScore, setTeamTwoScore] = useState("18");
  const [winningTeam, setWinningTeam] = useState<"team_one" | "team_two">("team_one");
  const [busy, setBusy] = useState(false);

  if (!match) {
    return null;
  }

  async function submit() {
    setBusy(true);
    try {
      await correctMatchResultLocal({
        sessionId,
        matchId: match!.id,
        result: {
          outcome: outcome as "team_one_win" | "team_two_win" | "draw" | "unscored",
          teamOneScore: Number(teamOneScore),
          teamTwoScore: Number(teamTwoScore),
          winningTeam: outcome.includes("win") ? winningTeam : null,
          correctionNote: "Corrected from history",
        },
      });
      onCorrected?.(match!.id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Correct result"
      description="Stats and ratings recompute from this match forward."
      footerActions={
        <Button isLoading={busy} onClick={() => void submit()}>
          Save correction
        </Button>
      }
    >
      <div className="space-y-3">
        <FormField label="Outcome">
          <Select value={outcome} onValueChange={setOutcome} options={OUTCOME_OPTIONS} />
        </FormField>
        <FormField label="Team A score">
          <input
            className="w-full rounded-card border border-border px-3 py-2"
            type="number"
            value={teamOneScore}
            onChange={(event) => setTeamOneScore(event.target.value)}
          />
        </FormField>
        <FormField label="Team B score">
          <input
            className="w-full rounded-card border border-border px-3 py-2"
            type="number"
            value={teamTwoScore}
            onChange={(event) => setTeamTwoScore(event.target.value)}
          />
        </FormField>
        {outcome === "team_one_win" || outcome === "team_two_win" ? (
          <FormField label="Winning team">
            <Select
              value={winningTeam}
              onValueChange={(value) => setWinningTeam(value as "team_one" | "team_two")}
              options={[
                { value: "team_one", label: "Team A" },
                { value: "team_two", label: "Team B" },
              ]}
            />
          </FormField>
        ) : null}
        <p className="text-caption text-muted-foreground">
          Ratings updated for tonight&apos;s session when rated mode is on.
        </p>
      </div>
    </Drawer>
  );
}

export function MatchHistoryList({
  sessionId,
  matches,
  courts,
  checkIns,
  sessionMode,
  correctedMatchIds,
  onSelectMatch,
  onCorrectMatch,
}: {
  sessionId: string;
  matches: LocalMatch[];
  courts: { id: string; name: string }[];
  checkIns: { id: string; playerDisplayName: string }[];
  sessionMode: SessionMode;
  correctedMatchIds?: Set<string>;
  onSelectMatch?: (matchId: string) => void;
  onCorrectMatch?: (matchId: string) => void;
}) {
  if (matches.length === 0) {
    return <p className="text-body text-muted-foreground">No matches yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {matches.map((match) => {
        const court = courts.find((row) => row.id === match.courtId);
        const teamOne = match.participants.filter((p) => p.team === "team_one");
        const teamTwo = match.participants.filter((p) => p.team === "team_two");
        const nameFor = (checkInId: string) =>
          checkIns.find((row) => row.id === checkInId)?.playerDisplayName ?? "Player";

        return (
          <li key={match.id}>
            {correctedMatchIds?.has(match.id) ? (
              <p className="mb-1 text-caption text-warning">Result updated — stats refreshing</p>
            ) : null}
            <MatchCard
              variant={match.status === "cancelled" ? "history" : "completed"}
              sessionMode={sessionMode}
              match={{
                id: match.id,
                status: match.status,
                courtName: court?.name,
                outcome: match.outcome ?? undefined,
                teamOneScore: match.teamOneScore ?? undefined,
                teamTwoScore: match.teamTwoScore ?? undefined,
                teams: [
                  { name: "Team A", players: teamOne.map((p) => nameFor(p.checkInId)) },
                  { name: "Team B", players: teamTwo.map((p) => nameFor(p.checkInId)) },
                ],
              }}
              actions={[
                ...(onSelectMatch
                  ? [{ label: "Details", onClick: () => onSelectMatch(match.id) }]
                  : []),
                ...(sessionMode === "live" && match.status === "completed" && onCorrectMatch
                  ? [{ label: "Correct", onClick: () => onCorrectMatch(match.id) }]
                  : []),
              ]}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function SessionHistoryHeader({
  sessionId,
  sessionName,
}: {
  sessionId: string;
  sessionName: string;
}) {
  return (
    <div>
      <Link to="/organizer/sessions/$sessionId/dashboard" params={{ sessionId }} className="text-caption text-primary">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-heading font-semibold">Match history · {sessionName}</h1>
    </div>
  );
}
