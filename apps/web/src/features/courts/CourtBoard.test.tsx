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
});
