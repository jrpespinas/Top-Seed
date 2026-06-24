/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerCard } from "./player-card.js";

describe("PlayerCard", () => {
  it("renders player name, skill, status, and session stats", () => {
    render(
      <PlayerCard
        player={{ id: "p1", displayName: "Bogs" }}
        checkIn={{
          queueStatus: "assigned",
          sessionSkillRating: 3,
          checkedInAt: "2026-06-09T10:00:00.000Z",
          matchesPlayed: 4,
          wins: 3,
        }}
        queuePosition={1}
        onOpenPlayerDetails={() => {}}
      />,
    );
    expect(screen.getByText("Bogs")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    expect(screen.getByText("Queued #1")).toBeInTheDocument();
    expect(screen.getByText("4 games")).toBeInTheDocument();
    expect(screen.getByText("3 wins")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Bogs" })).toBeInTheDocument();
  });

  it("renders compact variant", () => {
    render(
      <PlayerCard
        variant="compact"
        player={{ id: "p1", displayName: "Ling" }}
      />,
    );
    expect(screen.getByText("Ling")).toBeInTheDocument();
  });
});
