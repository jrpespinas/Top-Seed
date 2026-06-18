/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { AttentionRail } from "./AttentionRail.js";

async function renderWithRouter(element: ReactElement) {
  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => element,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const result = render(<RouterProvider router={router} />);
  await router.load();
  return result;
}

describe("AttentionRail", () => {
  it("renders nothing when healthy", async () => {
    await renderWithRouter(
      <AttentionRail
        sessionId="session-1"
        unpaidCount={0}
        connectionStatus="online"
        syncStatus="synced"
        pendingCount={0}
        failedCount={0}
        blockedCount={0}
        onRetrySync={vi.fn()}
      />,
    );
    expect(screen.queryByRole("region", { name: "Attention" })).not.toBeInTheDocument();
  });

  it("shows unpaid link when players owe fees", async () => {
    await renderWithRouter(
      <AttentionRail
        sessionId="session-1"
        unpaidCount={3}
        connectionStatus="online"
        syncStatus="synced"
        pendingCount={0}
        failedCount={0}
        blockedCount={0}
        onRetrySync={vi.fn()}
      />,
    );
    expect(await screen.findByText(/3 unpaid players/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View payments" })).toBeInTheDocument();
  });

  it("shows sync failure banner", async () => {
    await renderWithRouter(
      <AttentionRail
        sessionId="session-1"
        unpaidCount={0}
        connectionStatus="online"
        syncStatus="failed"
        pendingCount={0}
        failedCount={2}
        blockedCount={0}
        onRetrySync={vi.fn()}
        onReviewSyncIssues={vi.fn()}
      />,
    );
    expect(await screen.findByText(/Sync failed for 2 changes/i)).toBeInTheDocument();
  });
});
