import { Link } from "@tanstack/react-router";
import { SyncStatusBadge } from "../../components/domain/sync-status-badge.js";
import { formatDateTime } from "../../lib/format/datetime.js";
import { formatMoney } from "../../lib/format/money.js";
import { formatSessionStatus } from "../../lib/session-mode.js";
import type { LocalSession } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export interface SessionHeaderProps {
  session: LocalSession;
  courtCount: number;
  sessionMode: SessionMode;
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  pendingCount: number;
  blockedCount?: number;
  lastSyncedAt?: string;
}

export function SessionHeader({
  session,
  courtCount,
  sessionMode,
  syncStatus,
  pendingCount,
  blockedCount = 0,
  lastSyncedAt,
}: SessionHeaderProps) {
  const isLive = sessionMode === "live";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/organizer/sessions" className="text-caption text-primary hover:underline">
            ← Sessions
          </Link>
          <h1 className="mt-2 text-heading font-semibold">{session.name}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {session.venueName} · {formatDateTime(session.startsAt)} ·{" "}
            {formatMoney(session.feeAmount, session.currency)} · {courtCount} courts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-caption font-medium">
            {formatSessionStatus(session.status)}
            {!isLive ? " · Read-only" : ""}
          </span>
          <SyncStatusBadge
            status={
              syncStatus === "synced"
                ? "synced"
                : syncStatus === "syncing"
                  ? "syncing"
                  : syncStatus === "failed"
                    ? "failed"
                    : "pending"
            }
            pendingCount={pendingCount + blockedCount}
            lastSyncedAt={lastSyncedAt}
          />
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 text-caption">
        <Link
          to="/organizer/sessions/$sessionId/players"
          params={{ sessionId: session.id }}
          className="rounded-control bg-muted px-3 py-1 hover:bg-primary/10"
        >
          Players
        </Link>
        <Link
          to="/organizer/sessions/$sessionId/payments"
          params={{ sessionId: session.id }}
          className="rounded-control bg-muted px-3 py-1 hover:bg-primary/10"
        >
          Payments
        </Link>
        <Link
          to="/organizer/sessions/$sessionId/history"
          params={{ sessionId: session.id }}
          className="rounded-control bg-muted px-3 py-1 hover:bg-primary/10"
        >
          History
        </Link>
        <Link
          to="/organizer/leaderboard"
          search={{ sessionId: session.id }}
          className="rounded-control bg-muted px-3 py-1 hover:bg-primary/10"
        >
          Leaderboard
        </Link>
      </nav>
    </section>
  );
}
