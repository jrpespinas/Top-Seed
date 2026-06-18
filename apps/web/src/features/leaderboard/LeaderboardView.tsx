import { Link } from "@tanstack/react-router";
import { EmptyState } from "../../components/ui/empty-state.js";
import { OfflineBanner } from "../../components/domain/offline-banner.js";
import { Select } from "../../components/ui/select.js";
import type { LeaderboardEntryDto } from "@top-seed/contracts";
import type { LeaderboardScope, LeaderboardSortKey } from "../../lib/leaderboard-snapshot.js";

function formatWinRate(winRate: number | null): string {
  if (winRate === null) {
    return "—";
  }
  return `${Math.round(winRate * 100)}%`;
}

export function LeaderboardView({
  entries,
  scope,
  sortKey,
  onScopeChange,
  onSortChange,
  onOpenPlayer,
  showFreshnessBanner,
}: {
  entries: LeaderboardEntryDto[];
  scope: LeaderboardScope;
  sortKey: LeaderboardSortKey;
  onScopeChange: (scope: LeaderboardScope) => void;
  onSortChange: (sortKey: LeaderboardSortKey) => void;
  onOpenPlayer?: (playerProfileId: string) => void;
  showFreshnessBanner?: boolean;
}) {
  return (
    <section className="space-y-4">
      <OfflineBanner
        connectionStatus="online"
        syncStatus="synced"
        pendingCount={0}
        failedCount={0}
      />
      {showFreshnessBanner ? (
        <p className="rounded-card border border-warning/30 bg-attention-surface px-3 py-2 text-caption">
          Stats may be updating after a recent correction.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-control px-3 py-2 text-label ${scope === "club" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            onClick={() => onScopeChange("club")}
          >
            Club
          </button>
          <button
            type="button"
            className={`rounded-control px-3 py-2 text-label ${scope === "session" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            onClick={() => onScopeChange("session")}
          >
            This session
          </button>
        </div>
        <Select
          value={sortKey}
          onValueChange={(value) => onSortChange(value as LeaderboardSortKey)}
          options={[
            { value: "rating", label: "Rating" },
            { value: "wins", label: "Wins" },
            { value: "losses", label: "Losses" },
            { value: "draws", label: "Draws" },
            { value: "games", label: "Games" },
            { value: "winRate", label: "Win %" },
            { value: "sessions", label: "Sessions" },
          ]}
          aria-label="Sort leaderboard"
        />
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No leaderboard data yet" description="Complete matches to populate stats." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="min-w-full text-body">
            <thead className="bg-muted text-caption">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-left">W-L-D</th>
                <th className="px-3 py-2 text-left">Win %</th>
                <th className="px-3 py-2 text-left">Games</th>
                <th className="px-3 py-2 text-left">Rating</th>
                {scope === "club" ? <th className="px-3 py-2 text-left">Sessions</th> : null}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.playerProfileId} className="border-t border-border">
                  <td className="px-3 py-2">{entry.rank}</td>
                  <td className="px-3 py-2">
                    {onOpenPlayer ? (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => onOpenPlayer(entry.playerProfileId)}
                      >
                        {entry.displayName}
                      </button>
                    ) : (
                      entry.displayName
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {entry.wins}-{entry.losses}-{entry.draws}
                  </td>
                  <td className="px-3 py-2">{formatWinRate(entry.winRate)}</td>
                  <td className="px-3 py-2">{entry.matchesPlayed}</td>
                  <td className="px-3 py-2">{entry.currentRating.toFixed(1)}</td>
                  {scope === "club" ? (
                    <td className="px-3 py-2">{entry.attendanceCount}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function LeaderboardPageHeader({ sessionId }: { sessionId?: string }) {
  return (
    <div>
      {sessionId ? (
        <Link
          to="/organizer/sessions/$sessionId/dashboard"
          params={{ sessionId }}
          className="text-caption text-primary"
        >
          ← Dashboard
        </Link>
      ) : (
        <Link to="/organizer/sessions" className="text-caption text-primary">
          ← Sessions
        </Link>
      )}
      <h1 className="mt-2 text-heading font-semibold">Leaderboard</h1>
    </div>
  );
}
