"use client";

import { useState } from "react";
import { CalendarDays, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatSessionDate } from "@/lib/utils";
import { useConfirmFocus } from "@/hooks/useConfirmFocus";
import type { SessionStatus } from "@/types";

interface SessionHeaderProps {
  session: {
    id: string;
    date: string;
    status: SessionStatus;
    playerCount: number;
  };
  activeCourts: number;
  totalCourts: number;
  onClose: () => void;
}

export function SessionHeader({
  session,
  activeCourts,
  totalCourts,
  onClose,
}: SessionHeaderProps) {
  const [closeConfirm, setCloseConfirm] = useState(false);
  const { triggerRef: closeBtnRef, cancelRef: cancelBtnRef } = useConfirmFocus(closeConfirm);

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border flex-shrink-0 gap-3">
      {/* Left: session identity */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays
            size={14}
            strokeWidth={2}
            className="text-muted flex-shrink-0"
            aria-hidden
          />
          <span className="text-sm font-semibold text-ink truncate">
            {formatSessionDate(session.date)}
          </span>
        </div>
        <StatusBadge status={session.status === "OPEN" ? "open" : "closed"} />
        <div className="hidden sm:flex items-center gap-1.5 text-muted">
          <Users size={12} strokeWidth={1.75} className="flex-shrink-0" aria-hidden />
          <span className="font-mono text-xs tabular-nums">{session.playerCount}</span>
          <span className="select-none text-muted/40">·</span>
          <span className="font-mono text-xs tabular-nums">
            {activeCourts}/{totalCourts} courts
          </span>
        </div>
      </div>

      {/* Right: session close */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!closeConfirm ? (
          <button
            ref={closeBtnRef}
            onClick={() => setCloseConfirm(true)}
            className="text-xs font-medium text-muted hover:text-ink hover:bg-surface-elevated transition-colors px-3 py-1.5 rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px]"
          >
            Close Session
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-xs text-muted">Close session?</span>
            <button
              onClick={() => {
                setCloseConfirm(false);
                onClose();
              }}
              className="text-xs font-semibold bg-error/15 text-error hover:bg-error/25 transition-colors px-2.5 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 min-h-[36px]"
            >
              Confirm
            </button>
            <button
              ref={cancelBtnRef}
              onClick={() => setCloseConfirm(false)}
              className="text-xs text-muted hover:text-ink transition-colors px-2 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
