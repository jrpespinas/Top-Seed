import { Link, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { SyncStatusBadge } from "../../components/domain/sync-status-badge.js";
import { DropdownMenu } from "../../components/ui/dropdown-menu.js";
import { IconButton } from "../../components/ui/icon-button.js";
import { cn } from "../../lib/cn.js";
import { formatDateTime } from "../../lib/format/datetime.js";
import { formatMoney } from "../../lib/format/money.js";
import { formatSessionStatus } from "../../lib/session-mode.js";
import type { LocalSession } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";

export type SessionWorkspaceView = "dashboard" | "payments" | "history" | "players";

export interface SessionWorkspaceBarProps {
  session: LocalSession;
  courtCount: number;
  sessionMode: SessionMode;
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  pendingCount: number;
  blockedCount?: number;
  lastSyncedAt?: string;
  activeView?: SessionWorkspaceView;
  sticky?: boolean;
  className?: string;
}

export function SessionWorkspaceBar({
  session,
  courtCount,
  sessionMode,
  syncStatus,
  pendingCount,
  blockedCount = 0,
  lastSyncedAt,
  activeView = "dashboard",
  sticky = true,
  className,
}: SessionWorkspaceBarProps) {
  const navigate = useNavigate();
  const isLive = sessionMode === "live";
  const meta = `${session.venueName} · ${formatDateTime(session.startsAt)} · ${formatMoney(session.feeAmount, session.currency)} · ${courtCount} courts`;

  const menuItems = [
    ...(activeView !== "dashboard"
      ? [
          {
            label: "Live dashboard",
            onSelect: () =>
              void navigate({
                to: "/organizer/sessions/$sessionId/dashboard",
                params: { sessionId: session.id },
              }),
          },
        ]
      : []),
    ...(activeView !== "payments"
      ? [
          {
            label: "Payments",
            onSelect: () =>
              void navigate({
                to: "/organizer/sessions/$sessionId/payments",
                params: { sessionId: session.id },
              }),
          },
        ]
      : []),
    ...(activeView !== "history"
      ? [
          {
            label: "Match history",
            onSelect: () =>
              void navigate({
                to: "/organizer/sessions/$sessionId/history",
                params: { sessionId: session.id },
              }),
          },
        ]
      : []),
    {
      label: "Leaderboard (this session)",
      onSelect: () =>
        void navigate({
          to: "/organizer/leaderboard",
          search: { sessionId: session.id },
        }),
    },
    {
      label: "All sessions",
      onSelect: () => void navigate({ to: "/organizer/sessions" }),
    },
  ];

  const viewLabel =
    activeView === "payments"
      ? "Payments"
      : activeView === "history"
        ? "History"
        : activeView === "players"
          ? "Players"
          : null;

  return (
    <header
      className={cn(
        "border-b border-border/60 bg-background/95 backdrop-blur-sm",
        sticky && "sticky top-0 z-30",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to="/organizer/sessions"
            className="shrink-0 text-caption font-semibold text-primary hover:underline"
          >
            Top Seed
          </Link>
          <span className="hidden text-muted-foreground sm:inline" aria-hidden>
            /
          </span>
          <Link
            to="/organizer/sessions"
            className="hidden shrink-0 text-caption text-muted-foreground hover:text-primary sm:inline"
          >
            Sessions
          </Link>
          <span className="hidden text-muted-foreground md:inline" aria-hidden>
            ·
          </span>
          <p className="min-w-0 truncate text-label font-semibold text-foreground">
            {session.name}
            {viewLabel ? (
              <span className="font-normal text-muted-foreground"> · {viewLabel}</span>
            ) : null}
          </p>
          <p className="hidden w-full text-caption text-muted-foreground lg:block lg:w-auto lg:truncate">
            {meta}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-caption font-medium text-foreground">
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
          <DropdownMenu
            align="end"
            trigger={
              <IconButton label="Session menu" size="compact">
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
            }
            items={menuItems}
          />
        </div>
      </div>
      <p className="pb-1.5 text-caption text-muted-foreground lg:hidden">{meta}</p>
    </header>
  );
}
