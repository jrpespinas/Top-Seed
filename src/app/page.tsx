"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { SessionHeader } from "@/components/dashboard/SessionHeader";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getDefaultSessionName } from "@/lib/utils";
import {
  useCurrentSession,
  useCourtsSnapshot,
  useQueueSnapshot,
  useBenchSnapshot,
  startSession,
  renameSession,
  closeSession,
} from "@/lib/session-store";
import { useMatchLog, removeMatchRecordsForSessions } from "@/lib/match-log-store";

export default function DashboardPage() {
  const session = useCurrentSession();
  const courts = useCourtsSnapshot();
  const queue = useQueueSnapshot();
  const bench = useBenchSnapshot();
  const matches = useMatchLog();

  // Every session-store hook above starts null/empty deterministically for
  // SSR-safe hydration (see session-store.ts), then syncs from localStorage
  // in its own effect. This flag defers the NoSessionState-vs-Dashboard
  // branch until after that first sync lands — otherwise an organizer
  // returning to a live session sees a flash of "Start Session" before the
  // real dashboard takes over. All the hooks above register their sync
  // effects earlier than this one, so by the time `hasHydrated` flips true,
  // `session` already reflects the real stored value in the same re-render.
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => setHasHydrated(true), []);

  if (!hasHydrated) {
    return <div className="flex-1" />;
  }

  if (!session) {
    return <NoSessionState onStart={(name) => startSession(name)} />;
  }

  const activeCourts = courts.filter((c) => c.status === "IN_USE").length;
  const playerCount = queue.length + bench.length;

  return (
    <div className="flex flex-col min-h-full">
      <SessionHeader
        session={{ id: session.id, name: session.name, date: session.date, status: "OPEN", playerCount }}
        activeCourts={activeCourts}
        totalCourts={courts.length}
        onRename={(name) => renameSession(name)}
        onClose={() => {
          const result = closeSession(matches);
          if (result) removeMatchRecordsForSessions(result.evictedSessionIds);
        }}
      />
      <DashboardClient key={session.id} sessionId={session.id} />
    </div>
  );
}

function NoSessionState({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState(getDefaultSessionName());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleStart() {
    onStart(name);
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-xs w-full">
        <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
          <CalendarDays
            size={22}
            strokeWidth={1.75}
            className="text-muted"
            aria-hidden
          />
        </div>
        <h2
          className="text-base font-semibold text-ink mb-1"
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          No active session
        </h2>
        <p
          className="text-sm text-muted mb-5"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          Start a session to begin recording matches, managing the queue, and
          tracking payments.
        </p>

        <div className="text-left mb-4">
          <label htmlFor="session-name" className="block text-xs font-medium text-muted mb-1.5">
            Session name
          </label>
          <input
            ref={inputRef}
            id="session-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleStart();
            }}
            autoComplete="off"
            className="w-full bg-bg border border-border rounded-md px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors duration-150 min-h-[44px]"
          />
        </div>

        <button
          onClick={handleStart}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-bg text-sm font-semibold px-5 py-2.5 rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[44px]"
        >
          <Plus size={15} strokeWidth={2.5} aria-hidden />
          Start Session
        </button>
      </div>
    </div>
  );
}
