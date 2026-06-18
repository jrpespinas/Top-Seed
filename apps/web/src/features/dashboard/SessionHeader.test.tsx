/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SessionHeader } from "./SessionHeader.js";

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

describe("SessionHeader", () => {
  it("does not render offline banner when synced", async () => {
    await renderWithRouter(
      <SessionHeader
        session={session}
        courtCount={3}
        sessionMode="live"
        syncStatus="synced"
        pendingCount={0}
      />,
    );
    expect(screen.queryByText(/All changes synced/i)).not.toBeInTheDocument();
    expect(await screen.findByText("Tuesday Intense Badminton")).toBeInTheDocument();
  });

  it("does not show complete session in header", async () => {
    await renderWithRouter(
      <SessionHeader
        session={session}
        courtCount={3}
        sessionMode="live"
        syncStatus="synced"
        pendingCount={0}
      />,
    );
    expect(screen.queryByRole("button", { name: "Complete session" })).not.toBeInTheDocument();
  });
});
