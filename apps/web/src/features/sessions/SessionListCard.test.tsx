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
import { SessionListCard } from "./SessionListCard.js";

const session = {
  id: "session-1",
  organizationId: "org-default",
  name: "Tuesday Open Play",
  venueName: "Courts",
  startsAt: "2026-06-09T18:00:00.000Z",
  status: "active",
  feeAmount: 150,
  currency: "PHP",
  queueMode: "suggested" as const,
  ratingMode: "casual" as const,
};

function renderCard(element: ReactElement) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => element,
  });
  const routeTree = rootRoute.addChildren([indexRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
}

describe("SessionListCard", () => {
  it("renders open action for live session", async () => {
    renderCard(<SessionListCard session={session} checkInCount={2} onComplete={vi.fn()} />);
    expect(await screen.findByText("Tuesday Open Play")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByText(/2 checked in/)).toBeInTheDocument();
  });

  it("renders view action for completed session", async () => {
    renderCard(
      <SessionListCard session={{ ...session, status: "completed" }} checkInCount={5} />,
    );
    expect(await screen.findByText("Tuesday Open Play")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View session" })).toBeInTheDocument();
    expect(screen.getByText(/Read-only/)).toBeInTheDocument();
  });
});
