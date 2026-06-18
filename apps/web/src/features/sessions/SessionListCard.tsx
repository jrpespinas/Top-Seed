import { Link } from "@tanstack/react-router";
import type { LocalSession } from "../../db/types.js";
import { formatDateTime } from "../../lib/format/datetime.js";
import { formatMoney } from "../../lib/format/money.js";
import { formatSessionStatus, getSessionMode, isLiveSession } from "../../lib/session-mode.js";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { Button } from "../../components/ui/button.js";
import { Card, CardBody } from "../../components/ui/card.js";
import { cn } from "../../lib/cn.js";

export interface SessionListCardProps {
  session: LocalSession;
  checkInCount?: number;
  onComplete?: (sessionId: string) => void;
}

export function SessionListCard({ session, checkInCount = 0, onComplete }: SessionListCardProps) {
  const mode = getSessionMode(session.status);
  const isLive = isLiveSession(session.status);
  const actionLabel = mode === "ended" ? "View session" : "Open";

  return (
    <Card>
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-title font-semibold text-foreground">{session.name}</h2>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-caption font-medium",
                mode === "ended" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
              )}
            >
              {formatSessionStatus(session.status)}
              {mode === "ended" ? " · Read-only" : ""}
            </span>
          </div>
          <p className="mt-1 text-body text-muted-foreground">
            {session.venueName} · {formatDateTime(session.startsAt)}
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            {formatMoney(session.feeAmount, session.currency)} · {session.queueMode} queue ·{" "}
            {session.ratingMode} · {checkInCount} checked in
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/organizer/sessions/$sessionId/dashboard"
            params={{ sessionId: session.id }}
          >
            <Button variant={isLive ? "primary" : "secondary"}>{actionLabel}</Button>
          </Link>
          {isLive && onComplete ? (
            <ConfirmAction
              triggerLabel="Mark complete"
              title="Complete this session?"
              description="Players still waiting will be marked done. This session becomes read-only."
              confirmLabel="Complete session"
              variant="danger"
              onConfirm={async () => onComplete(session.id)}
            />
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
