/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CourtCard } from "./court-card.js";

describe("CourtCard", () => {
  it("renders idle open court with empty slots", () => {
    render(
      <CourtCard
        court={{ id: "c1", name: "Court 1" }}
        uiStatus="open"
        teamSlots={{
          teamA: [null, null],
          teamB: [null, null],
        }}
      />,
    );
    expect(screen.getByText("Court 1")).toBeInTheDocument();
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.getAllByText("Empty")).toHaveLength(4);
    expect(screen.getByText("vs")).toBeInTheDocument();
    expect(screen.queryByText("Drop player here")).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Finish match on Court 2" })).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("opens delete confirmation from overflow menu", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <CourtCard
        court={{ id: "c3", name: "Court 3" }}
        uiStatus="open"
        teamSlots={{ teamA: [null, null], teamB: [null, null] }}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for Court 3" }));
    await user.click(screen.getByText("Delete Court 3"));
    expect(screen.getByText("Delete Court 3?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete court" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
