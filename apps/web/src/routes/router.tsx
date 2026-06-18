import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { z } from "zod";
import { ApiStatusBanner } from "../components/ApiStatusBanner";
import { LocalSessionDevHarness } from "../components/LocalSessionDevHarness";
import { ComponentGallery } from "../pages/dev/ComponentGallery";
import { SessionListPage } from "../features/sessions/SessionListPage";
import { NewSessionPage } from "../features/sessions/NewSessionPage";
import { SessionDashboardPage } from "../features/dashboard/SessionDashboardPage";
import { SessionPaymentsPage } from "../features/payments/SessionPaymentsPage";
import { SessionHistoryPage } from "../features/history/SessionHistoryPage";
import { LeaderboardPage } from "../features/leaderboard/LeaderboardPage";
import { SessionPlayersPage } from "../features/players/SessionPlayersPage";
import { db } from "../db/database";

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isSessionWorkspace = /^\/organizer\/sessions\/[^/]+\/(dashboard|payments|history|players)/.test(
    pathname,
  );
  const shellWidth = isSessionWorkspace ? "max-w-[1400px]" : "max-w-6xl";

  return (
    <div className="min-h-screen">
      {!isSessionWorkspace ? (
        <header className="border-b border-border bg-white px-4 py-3">
          <div className={`mx-auto flex ${shellWidth} items-center justify-between`}>
            <Link to="/organizer/sessions" className="text-lg font-semibold text-primary">
              Top Seed
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link to="/organizer/sessions" className="hover:text-primary">
                Sessions
              </Link>
              <Link to="/organizer/leaderboard" className="hover:text-primary">
                Leaderboard
              </Link>
              {import.meta.env.DEV ? (
                <Link to="/dev/components" className="hover:text-primary">
                  Components
                </Link>
              ) : null}
            </nav>
          </div>
        </header>
      ) : null}
      <main className={`mx-auto ${shellWidth} ${isSessionWorkspace ? "px-3 py-2" : "p-4"}`}>
        <Outlet />
      </main>
    </div>
  );
}

function DevComponentsPage() {
  if (!import.meta.env.DEV) {
    return (
      <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Not found</h1>
      </section>
    );
  }
  return <ComponentGallery />;
}

function DevHarnessPage() {
  if (!import.meta.env.DEV) {
    return (
      <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Not found</h1>
      </section>
    );
  }
  return (
    <>
      <ApiStatusBanner />
      <LocalSessionDevHarness />
    </>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const active = await db.sessions.where("status").equals("active").toArray();
    if (active.length === 1 && active[0]) {
      throw redirect({
        to: "/organizer/sessions/$sessionId/dashboard",
        params: { sessionId: active[0].id },
      });
    }
    throw redirect({ to: "/organizer/sessions" });
  },
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions",
  component: SessionListPage,
});

const newSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions/new",
  component: NewSessionPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions/$sessionId/dashboard",
  component: SessionDashboardPage,
});

const paymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions/$sessionId/payments",
  validateSearch: z.object({
    status: z.enum(["all", "unpaid", "partial", "paid", "waived", "refunded"]).optional(),
  }),
  component: SessionPaymentsPage,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions/$sessionId/history",
  component: SessionHistoryPage,
});

const playersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions/$sessionId/players",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/organizer/sessions/$sessionId/dashboard",
      params: { sessionId: params.sessionId },
    });
  },
  component: SessionPlayersPage,
});

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/leaderboard",
  validateSearch: z.object({
    sessionId: z.string().optional(),
  }),
  component: LeaderboardPage,
});

const devHarnessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions/dev-harness",
  component: DevHarnessPage,
});

const devComponentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dev/components",
  component: DevComponentsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  sessionsRoute,
  newSessionRoute,
  dashboardRoute,
  paymentsRoute,
  historyRoute,
  playersRoute,
  leaderboardRoute,
  devHarnessRoute,
  devComponentsRoute,
]);

export { routeTree };

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
