/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DesktopDndProvider } from "./DesktopDndProvider.js";
import type { PegboardDropContext } from "./resolvePegboardDrop.js";

function baseDropContext(): PegboardDropContext {
  return {
    sessionId: "session-1",
    sessionMode: "live",
    checkIns: [],
    queuedMatches: [],
    addPlayerToQueuedSlot: vi.fn().mockResolvedValue(undefined),
    movePlayerInQueuedSlot: vi.fn().mockResolvedValue(undefined),
  };
}

describe("DesktopDndProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children without DndContext when disabled", () => {
    render(
      <DesktopDndProvider enabled={false} dropContext={baseDropContext()}>
        <p>Pegboard content</p>
      </DesktopDndProvider>,
    );
    expect(screen.getByText("Pegboard content")).toBeInTheDocument();
  });

  it("renders children and aria-live region when enabled", () => {
    render(
      <DesktopDndProvider enabled dropContext={baseDropContext()}>
        <p>Pegboard content</p>
      </DesktopDndProvider>,
    );
    expect(screen.getByText("Pegboard content")).toBeInTheDocument();
    expect(document.getElementById("pegboard-dnd-status")).toBeInTheDocument();
  });
});
