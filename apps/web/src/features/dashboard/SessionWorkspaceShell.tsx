import type { ReactNode } from "react";
import { SessionWorkspaceBar, type SessionWorkspaceView } from "./SessionWorkspaceBar.js";
import { SessionSyncBar } from "../sync/SessionSyncBar.js";
import { useSessionChrome } from "../../hooks/useSessionChrome.js";

export interface SessionWorkspaceShellProps {
  sessionId: string;
  activeView: SessionWorkspaceView;
  children: ReactNode;
  sticky?: boolean;
}

export function SessionWorkspaceShell({
  sessionId,
  activeView,
  children,
  sticky = true,
}: SessionWorkspaceShellProps) {
  const chrome = useSessionChrome(sessionId);

  if (!chrome.session) {
    return (
      <section className="rounded-card border border-border bg-surface p-6">
        <h1 className="text-heading font-semibold">Session not found</h1>
        <p className="mt-2 text-body text-muted-foreground">
          This session is not in local storage yet.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <SessionWorkspaceBar
        session={chrome.session}
        courtCount={chrome.courtCount}
        sessionMode={chrome.sessionMode}
        syncStatus={chrome.syncStatus}
        pendingCount={chrome.pendingCount}
        blockedCount={chrome.blockedCount}
        lastSyncedAt={chrome.lastSyncedAt}
        activeView={activeView}
        sticky={sticky}
      />
      {activeView === "admin" ? (
        <SessionSyncBar
          connectionStatus={chrome.connectionStatus}
          syncStatus={chrome.syncStatus}
          pendingCount={chrome.pendingCount}
          failedCount={chrome.failedCount}
          blockedCount={chrome.blockedCount}
          lastSyncedAt={chrome.lastSyncedAt}
          onRetry={() => void chrome.retry()}
          onReview={chrome.openSyncReview}
        />
      ) : null}
      {children}
      {chrome.syncReviewPanel}
    </div>
  );
}
