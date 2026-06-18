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
import { SupportingStrip } from "./SupportingStrip.js";

const session = {
  id: "session-1",
  organizationId: "org-default",
  name: "Night",
  venueName: "Hall",
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
  const result = render(<RouterProvider router={router} />);
  await router.load();
  return result;
}

describe("SupportingStrip", () => {
  it("is hidden before first check-in", async () => {
    await renderWithRouter(
      <SupportingStrip
        session={session}
        collected={0}
        expectedTotal={0}
        recentMatches={[]}
        checkIns={[]}
        courts={[]}
        sessionId="session-1"
        sessionMode="live"
        checkedInCount={0}
        onCompleteSession={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Session summary")).not.toBeInTheDocument();
  });

  it("shows collected total after check-in", async () => {
    await renderWithRouter(
      <SupportingStrip
        session={session}
        collected={300}
        expectedTotal={600}
        recentMatches={[]}
        checkIns={[]}
        courts={[]}
        sessionId="session-1"
        sessionMode="live"
        checkedInCount={2}
        onCompleteSession={vi.fn()}
      />,
    );
    expect(await screen.findByText(/Collected/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View payments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leaderboard" })).toBeInTheDocument();
  });
});
