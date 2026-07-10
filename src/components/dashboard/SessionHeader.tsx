"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Pencil, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatSessionDate } from "@/lib/utils";
import { useConfirmFocus } from "@/hooks/useConfirmFocus";
import type { SessionStatus } from "@/types";

interface SessionHeaderProps {
  session: {
    id: string;
    name: string;
    date: string;
    status: SessionStatus;
    playerCount: number;
  };
  activeCourts: number;
  totalCourts: number;
  onRename: (name: string) => void;
  onClose: () => void;
}

export function SessionHeader({
  session,
  activeCourts,
  totalCourts,
  onRename,
  onClose,
}: SessionHeaderProps) {
  const [closeConfirm, setCloseConfirm] = useState(false);
  const { triggerRef: closeBtnRef, cancelRef: cancelBtnRef } = useConfirmFocus(closeConfirm);

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(session.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.select();
  }, [isEditingName]);

  function startEditing() {
    setDraftName(session.name);
    setIsEditingName(true);
  }

  function commitEdit() {
    setIsEditingName(false);
    if (draftName.trim() !== session.name) onRename(draftName);
  }

  function cancelEdit() {
    setIsEditingName(false);
    setDraftName(session.name);
  }

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 min-h-[56px] pt-[env(safe-area-inset-top)] border-b border-border flex-shrink-0 gap-3">
      {/* Left: session identity */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays
            size={14}
            strokeWidth={2}
            className="text-muted flex-shrink-0"
            aria-hidden
          />
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                else if (e.key === "Escape") cancelEdit();
              }}
              autoComplete="off"
              aria-label="Session name"
              className="text-base lg:text-sm font-semibold text-ink bg-bg border border-primary/50 rounded-sm px-1.5 py-0.5 -my-0.5 min-w-0 w-36 sm:w-48 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ) : (
            <button
              onClick={startEditing}
              className="group/name flex items-center gap-1.5 min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label={`Rename session, currently "${session.name}"`}
            >
              <span className="text-sm font-semibold text-ink truncate">
                {session.name}
              </span>
              <Pencil
                size={11}
                strokeWidth={2}
                className="text-muted/60 group-hover/name:text-muted flex-shrink-0 transition-colors"
                aria-hidden
              />
            </button>
          )}
        </div>
        <span className="hidden sm:inline text-xs text-muted flex-shrink-0">
          {formatSessionDate(session.date)}
        </span>
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
