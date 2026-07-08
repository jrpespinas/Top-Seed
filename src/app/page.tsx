"use client";

import { CalendarDays, Plus } from "lucide-react";
import { SessionHeader } from "@/components/dashboard/SessionHeader";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import {
  useCurrentSession,
  useCourtsSnapshot,
  useQueueSnapshot,
  useBenchSnapshot,
  startSession,
  closeSession,
} from "@/lib/session-store";
import { useMatchLog } from "@/lib/match-log-store";

export default function DashboardPage() {
  const session = useCurrentSession();
  const courts = useCourtsSnapshot();
  const queue = useQueueSnapshot();
  const bench = useBenchSnapshot();
  const matches = useMatchLog();

  if (!session) {
    return <NoSessionState onStart={() => startSession()} />;
  }

  const activeCourts = courts.filter((c) => c.status === "IN_USE").length;
  const playerCount = queue.length + bench.length;

  return (
    <div className="flex flex-col min-h-full">
      <SessionHeader
        session={{ id: session.id, date: session.date, status: "OPEN", playerCount }}
        activeCourts={activeCourts}
        totalCourts={courts.length}
        onClose={() => closeSession(matches)}
      />
      <DashboardClient key={session.id} sessionId={session.id} />
    </div>
  );
}

function NoSessionState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-xs">
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
          className="text-sm text-muted mb-6"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          Start a session to begin recording matches, managing the queue, and
          tracking payments.
        </p>
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-bg text-sm font-semibold px-5 py-2.5 rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[44px]"
        >
          <Plus size={15} strokeWidth={2.5} aria-hidden />
          Start Session
        </button>
      </div>
    </div>
  );
}
