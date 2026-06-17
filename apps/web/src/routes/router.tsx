import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { ApiStatusBanner } from "../components/ApiStatusBanner";
import { LocalSessionDevHarness } from "../components/LocalSessionDevHarness";

function RootLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-lg font-semibold text-primary">Top Seed</span>
          <nav className="flex gap-4 text-sm">
            <Link to="/organizer/sessions" className="hover:text-primary">
              Sessions
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm">Phase 0 scaffold — UI lands in later phases.</p>
    </section>
  );
}

function SessionsPage() {
  return (
    <>
      <ApiStatusBanner />
      <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <p className="mt-2 text-muted-foreground">
          Organizer session list. Create and open live sessions from here.
        </p>
        {import.meta.env.DEV ? <LocalSessionDevHarness /> : null}
      </section>
    </>
  );
}

function NewSessionPage() {
  return (
    <PlaceholderPage
      title="New session"
      description="Create a new open-play session with venue, fee, and queue settings."
    />
  );
}

function DashboardPage() {
  return (
    <PlaceholderPage
      title="Live dashboard"
      description="Court board, queue lanes, check-in, and match flow for the active session."
    />
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/organizer/sessions" });
  },
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions",
  component: SessionsPage,
});

const newSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions/new",
  component: NewSessionPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizer/sessions/$sessionId/dashboard",
  component: DashboardPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  sessionsRoute,
  newSessionRoute,
  dashboardRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
