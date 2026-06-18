import { useMemo, useState } from "react";
import { Drawer } from "../../components/ui/drawer.js";
import { Button } from "../../components/ui/button.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { useSyncReview } from "../../hooks/useSyncReview.js";
import { SyncActionRow } from "./SyncActionRow.js";
import {
  buildSyncReviewSummary,
  groupSyncActions,
  hasSyncIssues,
} from "./sync-review-helpers.js";

export function SyncReviewPanel({
  sessionId,
  isOpen,
  onOpenChange,
  connectionStatus,
  isSyncing,
  failedCount,
  blockedCount,
  pendingCount,
  onRetryAction,
  onRetryAllFailed,
}: {
  sessionId?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  connectionStatus: "online" | "offline";
  isSyncing: boolean;
  failedCount: number;
  blockedCount: number;
  pendingCount: number;
  onRetryAction: (actionId: string) => Promise<void>;
  onRetryAllFailed: () => Promise<void>;
}) {
  const { rows } = useSyncReview(sessionId);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const grouped = useMemo(() => groupSyncActions(rows.map((row) => row.action)), [rows]);

  const summary = buildSyncReviewSummary({ failed: failedCount, blocked: blockedCount, pending: pendingCount });
  const rowById = useMemo(() => new Map(rows.map((row) => [row.action.id, row])), [rows]);

  async function handleRetry(actionId: string) {
    setBusyActionId(actionId);
    try {
      await onRetryAction(actionId);
    } finally {
      setBusyActionId(null);
    }
  }

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
      {failedCount > 0 ? (
        <Button
          variant="secondary"
          isLoading={isSyncing}
          disabled={connectionStatus === "offline"}
          onClick={() => void onRetryAllFailed()}
        >
          Retry all failed
        </Button>
      ) : null}
      <Button variant="ghost" onClick={() => onOpenChange(false)}>
        Close
      </Button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Sync issues"
      description={summary}
      footerActions={footer}
      side={typeof window !== "undefined" && window.innerWidth < 768 ? "bottom" : "right"}
    >
      {!hasSyncIssues({ failed: failedCount, blocked: blockedCount, pending: pendingCount }) ? (
        <EmptyState title="All changes synced" description="Nothing needs your attention right now." />
      ) : (
        <div className="space-y-6">
          {grouped.failed.length > 0 ? (
            <section>
              <h3 className="mb-2 text-label font-semibold text-danger">Failed</h3>
              <ul className="divide-y divide-border rounded-card border border-border">
                {grouped.failed.map((action) => {
                  const row = rowById.get(action.id);
                  if (!row) {
                    return null;
                  }
                  return (
                    <li key={action.id}>
                      <SyncActionRow
                        row={row}
                        connectionStatus={connectionStatus}
                        isSyncing={isSyncing || busyActionId === action.id}
                        onRetry={handleRetry}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {grouped.blocked.length > 0 ? (
            <section>
              <h3 className="mb-2 text-label font-semibold text-attention">Blocked</h3>
              <ul className="divide-y divide-border rounded-card border border-border">
                {grouped.blocked.map((action) => {
                  const row = rowById.get(action.id);
                  if (!row) {
                    return null;
                  }
                  return (
                    <li key={action.id}>
                      <SyncActionRow
                        row={row}
                        connectionStatus={connectionStatus}
                        isSyncing={isSyncing}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {grouped.pending.length > 0 ? (
            <section>
              <h3 className="mb-2 text-label font-semibold text-muted-foreground">Pending</h3>
              <ul className="divide-y divide-border rounded-card border border-border">
                {grouped.pending.map((action) => {
                  const row = rowById.get(action.id);
                  if (!row) {
                    return null;
                  }
                  return (
                    <li key={action.id}>
                      <SyncActionRow
                        row={row}
                        connectionStatus={connectionStatus}
                        isSyncing={isSyncing}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
