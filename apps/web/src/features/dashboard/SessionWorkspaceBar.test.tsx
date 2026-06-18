/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SessionWorkspaceBar } from "./SessionWorkspaceBar.js";

const session = {
  id: "session-1",
  organizationId: "org-default",
  name: "Tuesday Intense Badminton",
  venueName: "Main Hall",
  startsAt: "2026-06-09T18:00:00.000Z",
  status: "active",
  feeAmount: 150,
  currency: "PHP",
  queueMode: "suggested" as const,
  ratingMode: "casual" as const,
};

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
  render(<RouterProvider router={router} />);
  await router.load();
}

describe("SessionWorkspaceBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders compact session context without sub-nav pills", async () => {
    await renderWithRouter(
      <SessionWorkspaceBar
        session={session}
        courtCount={3}
        sessionMode="live"
        syncStatus="synced"
        pendingCount={0}
        activeView="dashboard"
        sticky={false}
      />,
    );
    expect(await screen.findByText("Tuesday Intense Badminton")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Players" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Payments" })).not.toBeInTheDocument();
  });

  it("opens overflow menu with payments and history", async () => {
    const user = userEvent.setup();
    await renderWithRouter(
      <SessionWorkspaceBar
        session={session}
        courtCount={3}
        sessionMode="live"
        syncStatus="synced"
        pendingCount={0}
        activeView="dashboard"
        sticky={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Session menu" }));
    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByText("Match history")).toBeInTheDocument();
    expect(screen.getByText("Leaderboard (this session)")).toBeInTheDocument();
  });

  it("does not show complete session in the bar", async () => {
    await renderWithRouter(
      <SessionWorkspaceBar
        session={session}
        courtCount={3}
        sessionMode="live"
        syncStatus="synced"
        pendingCount={0}
        sticky={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Complete session" })).not.toBeInTheDocument();
  });
});
