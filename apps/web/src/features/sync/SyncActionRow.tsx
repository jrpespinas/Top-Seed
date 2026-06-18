import { Button } from "../../components/ui/button.js";
import { formatSyncErrorMessage } from "../../lib/sync-action-labels.js";
import type { ReviewableSyncAction } from "../../hooks/useSyncReview.js";

const STATUS_LABELS: Record<string, string> = {
  failed: "Failed",
  blocked: "Blocked",
  pending: "Pending",
};

export function SyncActionRow({
  row,
  connectionStatus,
  isSyncing,
  onRetry,
}: {
  row: ReviewableSyncAction;
  connectionStatus: "online" | "offline";
  isSyncing: boolean;
  onRetry?: (actionId: string) => void;
}) {
  const { action, description } = row;
  const statusLabel =
    action.status === "failed" ? "failed" : action.status === "blocked" ? "blocked" : "pending";

  return (
    <div className="space-y-2 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body font-medium">{description.label}</p>
          {description.context ? (
            <p className="text-caption text-muted-foreground">{description.context}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium">
          {STATUS_LABELS[statusLabel] ?? statusLabel}
        </span>
      </div>
      <p className="text-caption text-muted-foreground">{formatSyncErrorMessage(action)}</p>
      {action.status === "failed" && onRetry ? (
        <Button
          variant="secondary"
          size="compact"
          disabled={connectionStatus === "offline" || isSyncing}
          onClick={() => onRetry(action.id)}
        >
          {connectionStatus === "offline" ? "Will retry when back online" : "Retry"}
        </Button>
      ) : null}
    </div>
  );
}
