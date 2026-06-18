import { Link } from "@tanstack/react-router";
import { useLeaderboard } from "../../hooks/useLeaderboard.js";
import { Button } from "../../components/ui/button.js";

function formatWinRate(winRate: number | null): string {
  if (winRate === null) {
    return "—";
  }
  return `${Math.round(winRate * 100)}%`;
}

export function LeaderboardPreview({ sessionId }: { sessionId: string }) {
  const { entries } = useLeaderboard({ scope: "session", sessionId, sortKey: "wins" });
  const topFive = entries.slice(0, 5);

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title font-semibold">Leaderboard</h2>
        <Link to="/organizer/leaderboard" search={{ sessionId }}>
          <Button variant="ghost" size="compact">
            View all
          </Button>
        </Link>
      </div>
      {topFive.length === 0 ? (
        <p className="mt-2 text-body text-muted-foreground">No stats yet.</p>
      ) : (
        <table className="mt-3 w-full text-body">
          <thead className="text-caption text-muted-foreground">
            <tr>
              <th className="text-left">#</th>
              <th className="text-left">Player</th>
              <th className="text-left">W-L-D</th>
              <th className="text-left">Win %</th>
            </tr>
          </thead>
          <tbody>
            {topFive.map((entry) => (
              <tr key={entry.playerProfileId} className="border-t border-border">
                <td className="py-2">{entry.rank}</td>
                <td className="py-2">{entry.displayName}</td>
                <td className="py-2">
                  {entry.wins}-{entry.losses}-{entry.draws}
                </td>
                <td className="py-2">{formatWinRate(entry.winRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
