/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardView } from "./LeaderboardView.js";

describe("LeaderboardView", () => {
  it("renders session scope rows sorted by wins", () => {
    render(
      <LeaderboardView
        entries={[
          {
            playerProfileId: "player-1",
            displayName: "Alex",
            currentRating: 3.2,
            matchesPlayed: 2,
            wins: 2,
            losses: 0,
            draws: 0,
            winRate: 1,
            attendanceCount: 1,
            rank: 1,
          },
        ]}
        scope="session"
        sortKey="wins"
        onScopeChange={() => undefined}
        onSortChange={() => undefined}
      />,
    );

    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("2-0-0")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
