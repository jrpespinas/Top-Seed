import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ApiStatusBanner } from "../../components/ApiStatusBanner.js";
import { OfflineBanner } from "../../components/domain/offline-banner.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { Button } from "../../components/ui/button.js";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { resetAllLocalData } from "../../lib/reset-local-data.js";
import { completeSessionLocal } from "../../mutations/completeSession.js";
import { useSessions, type SessionFilter } from "../../hooks/useSessions.js";
import { useSyncReviewDrawer } from "../../hooks/useSyncReviewDrawer.js";
import { flushOutbox } from "../../sync/syncEngine.js";
import { SessionListCard } from "./SessionListCard.js";
import { cn } from "../../lib/cn.js";

const FILTERS: { value: SessionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export function SessionListPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<SessionFilter>("all");
  const { sessions, checkInCounts } = useSessions(filter);
  const syncReview = useSyncReviewDrawer();
  const sync = syncReview.sync;

  async function handleComplete(sessionId: string) {
    await completeSessionLocal(sessionId);
    if (sync.connectionStatus === "online") {
      await flushOutbox(sessionId);
    }
    await sync.refreshCounts();
  }

  async function handleResetAllLocalData() {
    await resetAllLocalData();
    await sync.refreshCounts();
  }

  return (
    <>
      <ApiStatusBanner />
      <OfflineBanner
        connectionStatus={sync.connectionStatus}
        syncStatus={sync.syncStatus}
        pendingCount={sync.pendingCount}
        failedCount={sync.failedCount}
        blockedCount={sync.blockedCount}
        lastSyncedAt={sync.lastSyncedAt}
        onRetry={() => void sync.retry()}
        onReview={syncReview.openReview}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-heading font-semibold">Sessions</h1>
            <p className="mt-1 text-body text-muted-foreground">
              Create and resume open-play nights. Completed sessions stay read-only.
            </p>
          </div>
          <Link to="/organizer/sessions/new">
            <Button size="large">Create session</Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-control px-3 py-1.5 text-label font-medium",
                filter === item.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            description="Create your first open-play session to get courts and queue lanes ready."
            action={
              <Link to="/organizer/sessions/new">
                <Button size="large">Create session</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sessions.map((session) => (
              <SessionListCard
                key={session.id}
                session={session}
                checkInCount={checkInCounts[session.id] ?? 0}
                onComplete={(sessionId) => void handleComplete(sessionId)}
              />
            ))}
          </div>
        )}

        {import.meta.env.DEV ? (
          <p className="text-caption text-muted-foreground">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => void navigate({ to: "/organizer/sessions/dev-harness" })}
            >
              Open local-first check-in dev harness
            </button>
          </p>
        ) : null}

        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-title font-semibold">Reset local data</h2>
          <p className="mt-1 text-body text-muted-foreground">
            Remove every session, player, check-in, queue, match, payment record, and pending sync
            action from this browser. Server data is not deleted. Use when local state is stuck or
            you want a clean slate on this device.
          </p>
          <div className="mt-3">
            <ConfirmAction
              triggerLabel="Clear all local data"
              title="Clear all local data?"
              description="This cannot be undone on this device. All sessions and offline work stored in this browser will be permanently removed. Data already synced to the server stays on the server."
              confirmLabel="Clear everything"
              variant="danger"
              onConfirm={handleResetAllLocalData}
            />
          </div>
        </section>
      </section>
      {syncReview.panel}
    </>
  );
}
