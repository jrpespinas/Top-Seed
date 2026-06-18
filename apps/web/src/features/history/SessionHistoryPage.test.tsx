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
import { SessionHistoryPage } from "./SessionHistoryPage.js";
import { clearDatabase, db } from "../../db/database.js";
import { createSessionLocal } from "../../mutations/createSession.js";

function renderPage(element: ReactElement) {
  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/organizer/sessions/$sessionId/history",
    component: () => element,
  });
  const routeTree = rootRoute.addChildren([pageRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/organizer/sessions/session-1/history"],
    }),
  });
  render(<RouterProvider router={router} />);
}

describe("SessionHistoryPage", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("lists completed matches and hides correct on ended session", async () => {
    await createSessionLocal({
      id: "session-1",
      name: "Ended Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
    });
    await db.sessions.update("session-1", { status: "completed" });
    await db.matches.add({
      id: "match-1",
      sessionId: "session-1",
      courtId: "court-1",
      status: "completed",
      outcome: "team_one_win",
      winningTeam: "team_one",
      teamOneScore: 21,
      teamTwoScore: 10,
      completedAt: "2026-06-09T19:00:00.000Z",
      participants: [
        { checkInId: "check-in-1", playerProfileId: "player-1", team: "team_one" },
        { checkInId: "check-in-2", playerProfileId: "player-2", team: "team_two" },
      ],
    });

    renderPage(<SessionHistoryPage />);
    expect(await screen.findByText(/Match history · Ended Night/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Correct" })).not.toBeInTheDocument();
  });
});
