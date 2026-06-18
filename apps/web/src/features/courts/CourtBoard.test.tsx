/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CourtBoard } from "./CourtBoard.js";

describe("CourtBoard", () => {
  it("renders open courts", () => {
    render(
      <CourtBoard
        courts={[
          { id: "court-1", sessionId: "session-1", name: "Court 1", status: "open", sortOrder: 0 },
        ]}
        matches={[]}
        checkIns={[]}
        sessionMode="live"
        onStartMatch={vi.fn()}
        onOpenMatch={vi.fn()}
      />,
    );
    expect(screen.getByText("Court 1")).toBeInTheDocument();
  });

  it("uses a vertical stack for pegboard layout", () => {
    const { container } = render(
      <CourtBoard
        layout="pegboard"
        courts={[
          { id: "court-1", sessionId: "session-1", name: "Court 1", status: "open", sortOrder: 0 },
          { id: "court-2", sessionId: "session-1", name: "Court 2", status: "open", sortOrder: 1 },
          { id: "court-3", sessionId: "session-1", name: "Court 3", status: "open", sortOrder: 2 },
        ]}
        matches={[]}
        checkIns={[]}
        sessionMode="live"
        onStartMatch={vi.fn()}
        onOpenMatch={vi.fn()}
      />,
    );
    const grid = container.querySelector(".grid-cols-1");
    expect(grid).toBeTruthy();
  });
});
