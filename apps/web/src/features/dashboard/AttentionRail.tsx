import { Link } from "@tanstack/react-router";
import { OfflineBanner } from "../../components/domain/offline-banner.js";
import {
  shouldShowAttentionRail,
  type AttentionRailVisibilityInput,
} from "./attention-rail-helpers.js";

export interface AttentionRailProps extends AttentionRailVisibilityInput {
  sessionId: string;
  lastSyncedAt?: string;
  onReviewSyncIssues?: () => void;
  onRetrySync: () => void;
}

export function AttentionRail({
  sessionId,
  unpaidCount,
  connectionStatus,
  syncStatus,
  pendingCount,
  failedCount,
  blockedCount,
  lastSyncedAt,
  onReviewSyncIssues,
  onRetrySync,
}: AttentionRailProps) {
  if (
    !shouldShowAttentionRail({
      unpaidCount,
      connectionStatus,
      syncStatus,
      pendingCount,
      failedCount,
      blockedCount,
    })
  ) {
    return null;
  }

  const showSyncBanner =
    connectionStatus === "offline" ||
    failedCount > 0 ||
    blockedCount > 0 ||
    pendingCount > 0 ||
    syncStatus === "failed" ||
    syncStatus === "pending" ||
    syncStatus === "syncing";

  return (
    <section
      aria-label="Attention"
      className="space-y-2 rounded-card border border-attention/30 bg-attention-surface px-4 py-3"
    >
      {unpaidCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-body">
          <p>
            {unpaidCount} unpaid player{unpaidCount === 1 ? "" : "s"}
          </p>
          <Link
            to="/organizer/sessions/$sessionId/payments"
            params={{ sessionId }}
            search={{ status: "unpaid" }}
            className="text-caption font-medium text-primary hover:underline"
          >
            View payments
          </Link>
        </div>
      ) : null}
      {showSyncBanner ? (
        <div className="[&>div]:mb-0">
          <OfflineBanner
            connectionStatus={connectionStatus}
            syncStatus={syncStatus}
            pendingCount={pendingCount}
            failedCount={failedCount}
            blockedCount={blockedCount}
            lastSyncedAt={lastSyncedAt}
            onRetry={onRetrySync}
            onReview={onReviewSyncIssues}
          />
        </div>
      ) : null}
    </section>
  );
}
