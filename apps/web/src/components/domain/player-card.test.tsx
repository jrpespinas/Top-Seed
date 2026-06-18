/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerCard } from "./player-card.js";

describe("PlayerCard", () => {
  it("renders player name, skill, and status", () => {
    render(
      <PlayerCard
        player={{ id: "p1", displayName: "Bogs" }}
        checkIn={{
          queueStatus: "waiting",
          sessionSkillRating: 3,
          checkedInAt: "2026-06-09T10:00:00.000Z",
          matchesPlayed: 2,
        }}
        queuePosition={1}
      />,
    );
    expect(screen.getByText("Bogs")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("2 games")).toBeInTheDocument();
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
