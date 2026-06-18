import { Link } from "@tanstack/react-router";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { formatMoney } from "../../lib/format/money.js";
import { displayNameForCheckIn } from "../../lib/dashboard-helpers.js";
import type { LocalCheckIn, LocalCourt, LocalMatch, LocalSession } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export interface SupportingStripProps {
  session: LocalSession;
  collected: number;
  expectedTotal: number;
  recentMatches: LocalMatch[];
  checkIns: LocalCheckIn[];
  courts: LocalCourt[];
  sessionId: string;
  sessionMode: SessionMode;
  checkedInCount: number;
  onCompleteSession: () => Promise<void>;
}

function formatRecentMatchLine(
  match: LocalMatch,
  courts: LocalCourt[],
  checkIns: LocalCheckIn[],
): string {
  const court = courts.find((row) => row.id === match.courtId);
  const teamOne = match.participants.filter((p) => p.team === "team_one");
  const teamTwo = match.participants.filter((p) => p.team === "team_two");
  const names = (players: typeof teamOne) =>
    players
      .map((p) => displayNameForCheckIn(p.checkInId, checkIns))
      .join(" & ") || "—";
  const score =
    match.teamOneScore != null && match.teamTwoScore != null
      ? ` ${match.teamOneScore}-${match.teamTwoScore}`
      : "";
  return `${court?.name ?? "Court"}: ${names(teamOne)} vs ${names(teamTwo)}${score}`;
}

export function SupportingStrip({
  session,
  collected,
  expectedTotal,
  recentMatches,
  checkIns,
  courts,
  sessionId,
  sessionMode,
  checkedInCount,
  onCompleteSession,
}: SupportingStripProps) {
  if (checkedInCount === 0) {
    return null;
  }

  const isLive = sessionMode === "live";
  const recentTeaser = recentMatches.slice(0, 2);

  return (
    <footer
      aria-label="Session summary"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-border bg-muted/40 px-4 py-3 text-caption text-muted-foreground"
    >
      <span>
        Collected {formatMoney(collected, session.currency)} of{" "}
        {formatMoney(expectedTotal, session.currency)}
        {" · "}
        <Link
          to="/organizer/sessions/$sessionId/payments"
          params={{ sessionId }}
          className="font-medium text-primary hover:underline"
        >
          View payments
        </Link>
      </span>
      <span aria-hidden="true">|</span>
      <span>
        {recentTeaser.length === 0 ? (
          <>
            No finished matches yet ·{" "}
            <Link
              to="/organizer/sessions/$sessionId/history"
              params={{ sessionId }}
              className="font-medium text-primary hover:underline"
            >
              View history
            </Link>
          </>
        ) : (
          <>
            Recent: {recentTeaser.map((m) => formatRecentMatchLine(m, courts, checkIns)).join(" · ")}{" "}
            ·{" "}
            <Link
              to="/organizer/sessions/$sessionId/history"
              params={{ sessionId }}
              className="font-medium text-primary hover:underline"
            >
              View history
            </Link>
          </>
        )}
      </span>
      <span aria-hidden="true">|</span>
      <Link
        to="/organizer/leaderboard"
        search={{ sessionId }}
        className="font-medium text-primary hover:underline"
      >
        Leaderboard
      </Link>
      {isLive ? (
        <>
          <span aria-hidden="true">|</span>
          <ConfirmAction
            triggerLabel="Complete session"
            title="Complete this session?"
            description="Players still waiting will be marked done. This session becomes read-only."
            confirmLabel="Complete session"
            variant="default"
            onConfirm={onCompleteSession}
          />
        </>
      ) : null}
    </footer>
  );
}
