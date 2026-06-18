/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CourtCard } from "./court-card.js";

describe("CourtCard", () => {
  it("renders team slots and court name", () => {
    render(
      <CourtCard
        court={{ id: "c1", name: "Court 1" }}
        uiStatus="open"
        teamSlots={{
          teamA: [null, null],
          teamB: [null, null],
        }}
        primaryAction={{ label: "Assign players", onClick: () => undefined }}
      />,
    );
    expect(screen.getByText("Court 1")).toBeInTheDocument();
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.getAllByText("Drop player here").length).toBe(4);
  });

  it("shows finish action for in-progress court", () => {
    render(
      <CourtCard
        court={{ id: "c2", name: "Court 2" }}
        uiStatus="inProgress"
        teamSlots={{
          teamA: [
            { id: "p1", displayName: "Alex", slotLabel: "A1" },
            { id: "p2", displayName: "Jordan", slotLabel: "A2" },
          ],
          teamB: [
            { id: "p3", displayName: "Sam", slotLabel: "B1" },
            { id: "p4", displayName: "Casey", slotLabel: "B2" },
          ],
        }}
        primaryAction={{ label: "Finish match", onClick: () => undefined }}
      />,
    );
    expect(screen.getByRole("button", { name: "Finish match" })).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });
});
