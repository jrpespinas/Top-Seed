"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Download } from "lucide-react";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatSessionDate } from "@/lib/utils";
import {
  useCurrentSession,
  useSessionArchive,
  useCourtsSnapshot,
  useQueueSnapshot,
  useBenchSnapshot,
} from "@/lib/session-store";
import { useMatchLog } from "@/lib/match-log-store";
import type { SessionPlayerSnapshot } from "@/types";

// null covers rows with no sessionJoinedAt — snapshots taken before this
// field was captured. Graceful degradation, not an error state.
function formatCheckinTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

interface SessionSummary {
  id: string;
  name: string;
  date: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
  players: SessionPlayerSnapshot[];
  matchCount: number;
  courtCount: number;
}

export function SessionDetailView({ sessionId }: { sessionId: string }) {
  const currentSession = useCurrentSession();
  const archive = useSessionArchive();
  const courts = useCourtsSnapshot();
  const queue = useQueueSnapshot();
  const bench = useBenchSnapshot();
  const matches = useMatchLog();

  const summary = useMemo<SessionSummary | null>(() => {
    if (currentSession?.id === sessionId) {
      // sessionJoinedAt lives on the queue/bench entry, not the embedded
      // player — carried through here so the open session's table can show
      // check-in time too, not just closed ones (see SessionPlayerSnapshot).
      const players: SessionPlayerSnapshot[] = [
        ...queue.map((e) => ({ ...e.player, sessionJoinedAt: e.sessionJoinedAt })),
        ...bench.map((e) => ({ ...e.player, sessionJoinedAt: e.sessionJoinedAt })),
      ];
      return {
        id: currentSession.id,
        name: currentSession.name,
        date: currentSession.date,
        status: "OPEN",
        closedAt: null,
        players,
        matchCount: matches.filter((m) => m.sessionId === currentSession.id && m.status === "COMPLETED").length,
        courtCount: courts.length,
      };
    }
    const record = archive.find((r) => r.id === sessionId);
    if (!record) return null;
    return {
      id: record.id,
      name: record.name,
      date: record.date,
      status: "CLOSED",
      closedAt: record.closedAt,
      players: record.players,
      matchCount: record.matchCount,
      courtCount: record.courtCount,
    };
  }, [currentSession, archive, sessionId, courts, queue, bench, matches]);

  // The match log is never purged on session close (see docs/specs/08-sessions.md),
  // so filtering by sessionId works identically whether this session is open or
  // closed — no need to branch like `summary` above does.
  const sessionMatches = useMemo(
    () => matches.filter((m) => m.sessionId === sessionId),
    [matches, sessionId]
  );

  if (!summary) {
    return (
      <div className="flex flex-col min-h-full">
        <DetailHeader />
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="text-sm text-muted">Session not found</p>
          <Link
            href="/sessions"
            className="text-xs text-primary hover:text-primary-hover mt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
          >
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  const paid = summary.players.filter((p) => p.paymentStatus === "PAID").length;
  const unpaid = summary.players.filter((p) => p.paymentStatus === "UNPAID").length;
  const waived = summary.players.filter((p) => p.paymentStatus === "WAIVED").length;

  return (
    <div className="flex flex-col min-h-full">
      <DetailHeader />

      {/* Session meta */}
      <div className="px-4 sm:px-6 py-4 border-b border-border flex flex-col gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <CalendarDays size={14} strokeWidth={2} className="text-muted flex-shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-ink truncate">{summary.name}</h1>
            <p className="text-xs text-muted mt-0.5">{formatSessionDate(summary.date)}</p>
          </div>
          <StatusBadge status={summary.status === "OPEN" ? "open" : "closed"} />
          <button
            onClick={async () => {
              // Dynamically imported: xlsx is a large library that should only
              // ever load when someone actually clicks Export, not on every
              // view of this page (courtside, tablet — see PRD "Speed over
              // completeness").
              const { downloadSessionWorkbook } = await import("@/lib/export-session");
              downloadSessionWorkbook(summary.date, sessionMatches, summary.players);
            }}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors px-2.5 py-1.5 rounded-md border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
          >
            <Download size={12} strokeWidth={2} aria-hidden />
            Export to Excel
          </button>
        </div>
        <p className="text-xs text-muted">
          <span className="font-mono tabular-nums">{summary.players.length}</span> players
          <span className="text-muted/40 mx-1.5">·</span>
          <span className="font-mono tabular-nums">{summary.matchCount}</span> matches
          <span className="text-muted/40 mx-1.5">·</span>
          <span className="font-mono tabular-nums">{summary.courtCount}</span> courts
          <span className="text-muted/40 mx-1.5">·</span>
          <span className="text-success font-medium tabular-nums">{paid}</span> paid
          <span className="text-muted/40 mx-1.5">·</span>
          <span className="text-warning font-medium tabular-nums">{unpaid}</span> unpaid
          {waived > 0 && (
            <>
              <span className="text-muted/40 mx-1.5">·</span>
              <span className="tabular-nums">{waived}</span> waived
            </>
          )}
        </p>
      </div>

      {/* Player table — read-only, frozen for closed sessions, live for the open one */}
      {summary.players.length > 0 ? (
        <table className="w-full border-collapse" role="grid" aria-label="Session players">
          <thead className="bg-bg">
            <tr className="border-b border-border">
              <th scope="col" className="text-left text-xs font-medium text-muted pl-4 sm:pl-6 pr-3 py-2.5 whitespace-nowrap">Name</th>
              <th scope="col" className="text-left text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[100px]">Skill</th>
              <th scope="col" className="hidden sm:table-cell text-left text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[56px]">Gender</th>
              <th scope="col" className="text-left text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[92px]">Payment</th>
              <th scope="col" className="hidden sm:table-cell text-right text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2.5 whitespace-nowrap w-[88px]">Check-in</th>
            </tr>
          </thead>
          <tbody>
            {summary.players.map((player) => (
              <tr key={player.id} className="border-b border-border/50">
                <td className="pl-4 sm:pl-6 pr-3 py-3">
                  <span className="text-sm font-medium text-ink truncate">{player.name}</span>
                </td>
                <td className="px-3 py-3">
                  <SkillBadge level={player.skillLevel} compact />
                </td>
                <td className="hidden sm:table-cell px-3 py-3">
                  {player.gender ? (
                    <GenderIcon gender={player.gender} size={14} />
                  ) : (
                    <span className="text-xs text-border">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={player.paymentStatus.toLowerCase() as "paid" | "unpaid" | "waived"} />
                </td>
                <td className="hidden sm:table-cell text-right pl-3 pr-4 sm:pr-6 py-3">
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {formatCheckinTime(player.sessionJoinedAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="text-sm text-muted">No players in this session</p>
        </div>
      )}
    </div>
  );
}

function DetailHeader() {
  return (
    <div className="sticky top-0 z-[var(--z-sticky)] pt-[env(safe-area-inset-top)] bg-bg border-b border-border">
      <div className="flex items-center px-4 sm:px-6 h-14">
        <Link
          href="/sessions"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border rounded-md px-1.5 py-1 -ml-1.5"
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          Sessions
        </Link>
      </div>
    </div>
  );
}
