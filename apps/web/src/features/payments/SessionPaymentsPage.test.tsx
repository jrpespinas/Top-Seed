/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SessionPaymentsPage } from "./SessionPaymentsPage.js";
import { clearDatabase } from "../../db/database.js";
import { createSessionLocal } from "../../mutations/createSession.js";

function renderPage(element: ReactElement, path = "/organizer/sessions/session-1/payments") {
  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/organizer/sessions/$sessionId/payments",
    component: () => element,
  });
  const routeTree = rootRoute.addChildren([pageRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
}

describe("SessionPaymentsPage", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("renders payments header when session exists", async () => {
    await createSessionLocal({
      id: "session-1",
      name: "Friday Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
    });

    renderPage(<SessionPaymentsPage />);
    expect(await screen.findByText(/Friday Night/)).toBeInTheDocument();
    expect(await screen.findByText(/· Payments/)).toBeInTheDocument();
  });
});
