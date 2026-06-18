import { Link, useParams } from "@tanstack/react-router";
import { OfflineBanner } from "../../components/domain/offline-banner.js";
import { Button } from "../../components/ui/button.js";
import { Card, CardBody } from "../../components/ui/card.js";
import { useSession } from "../../hooks/useSessions.js";
import { useSessionMode } from "../../hooks/useSessionMode.js";
import { useSyncEngine } from "../../hooks/useSyncEngine.js";
import { formatDateTime } from "../../lib/format/datetime.js";
import { formatMoney } from "../../lib/format/money.js";
import { formatSessionStatus } from "../../lib/session-mode.js";

export function SessionDashboardPlaceholder() {
  const { sessionId } = useParams({ from: "/organizer/sessions/$sessionId/dashboard" });
  const session = useSession(sessionId);
  const sessionMode = useSessionMode(session?.status);
  const sync = useSyncEngine(sessionId);

  if (!session) {
    return (
      <section className="rounded-card border border-border bg-surface p-6">
        <h1 className="text-heading font-semibold">Session not found</h1>
        <p className="mt-2 text-body text-muted-foreground">
          This session is not in local storage yet.
        </p>
        <Link to="/organizer/sessions" className="mt-4 inline-block">
          <Button variant="secondary">Back to sessions</Button>
        </Link>
      </section>
    );
  }

  return (
    <>
      <OfflineBanner
        connectionStatus={sync.connectionStatus}
        syncStatus={sync.syncStatus}
        pendingCount={sync.pendingCount}
        failedCount={sync.failedCount}
        lastSyncedAt={sync.lastSyncedAt}
        onRetry={() => void sync.retry()}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/organizer/sessions" className="text-caption text-primary hover:underline">
              ← Sessions
            </Link>
            <h1 className="mt-2 text-heading font-semibold">{session.name}</h1>
            <p className="mt-1 text-body text-muted-foreground">
              {session.venueName} · {formatDateTime(session.startsAt)}
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-caption font-medium">
            {formatSessionStatus(session.status)}
            {sessionMode === "ended" ? " · Read-only" : ""}
          </span>
        </div>

        <Card>
          <CardBody className="space-y-3">
            <p className="text-title font-semibold">Live dashboard — Phase 6</p>
            <p className="text-body text-muted-foreground">
              The pegboard (Available, Next, Now) lands in the next phase. This session already has
              courts, a Next lane, and settings saved locally
              {sessionMode === "ended" ? " in read-only mode." : "."}
            </p>
            <dl className="grid gap-2 text-body sm:grid-cols-2">
              <div>
                <dt className="text-caption text-muted-foreground">Fee</dt>
                <dd>{formatMoney(session.feeAmount, session.currency)}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Queue mode</dt>
                <dd className="capitalize">{session.queueMode}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Rating mode</dt>
                <dd className="capitalize">{session.ratingMode}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Session mode</dt>
                <dd className="capitalize">{sessionMode}</dd>
              </div>
            </dl>
            {sessionMode === "live" ? (
              <p className="text-caption text-muted-foreground">
                Check-in and court operations will appear here in Phase 6.
              </p>
            ) : (
              <p className="text-caption text-warning">
                Ended sessions are view-only. Live queue and check-in actions are hidden per MVP
                access rules.
              </p>
            )}
          </CardBody>
        </Card>
      </section>
    </>
  );
}
