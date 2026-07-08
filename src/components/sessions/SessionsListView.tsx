"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatSessionDate } from "@/lib/utils";
import {
  useCurrentSession,
  useSessionArchive,
  useCourtsSnapshot,
  useQueueSnapshot,
  useBenchSnapshot,
} from "@/lib/session-store";
import { useMatchLog } from "@/lib/match-log-store";
import type { PaymentStatus, Player } from "@/types";

interface SessionListRow {
  id: string;
  date: string;
  status: "OPEN" | "CLOSED";
  playerCount: number;
  matchCount: number;
  courtCount: number;
  paid: number;
  unpaid: number;
  waived: number;
}

function tallyPayments(players: { paymentStatus: PaymentStatus }[]) {
  let paid = 0, unpaid = 0, waived = 0;
  for (const p of players) {
    if (p.paymentStatus === "PAID") paid++;
    else if (p.paymentStatus === "UNPAID") unpaid++;
    else waived++;
  }
  return { paid, unpaid, waived };
}

function PaymentSummary({ paid, unpaid, waived }: { paid: number; unpaid: number; waived: number }) {
  if (paid + unpaid + waived === 0) {
    return <span className="text-xs text-border">—</span>;
  }
  return (
    <span className="text-xs text-muted whitespace-nowrap">
      <span className="text-success font-medium tabular-nums">{paid}</span> paid
      <span className="text-muted/40 mx-1">·</span>
      <span className="text-warning font-medium tabular-nums">{unpaid}</span> unpaid
      {waived > 0 && (
        <>
          <span className="text-muted/40 mx-1">·</span>
          <span className="tabular-nums">{waived}</span> waived
        </>
      )}
    </span>
  );
}

export function SessionsListView() {
  const currentSession = useCurrentSession();
  const archive = useSessionArchive();
  const courts = useCourtsSnapshot();
  const queue = useQueueSnapshot();
  const bench = useBenchSnapshot();
  const matches = useMatchLog();
  const [headerShadow, setHeaderShadow] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderShadow(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const rows = useMemo<SessionListRow[]>(() => {
    const openRow: SessionListRow[] = [];
    if (currentSession) {
      const players: Player[] = [...queue.map((e) => e.player), ...bench.map((e) => e.player)];
      const { paid, unpaid, waived } = tallyPayments(players);
      openRow.push({
        id: currentSession.id,
        date: currentSession.date,
        status: "OPEN",
        playerCount: players.length,
        matchCount: matches.filter((m) => m.sessionId === currentSession.id && m.status === "COMPLETED").length,
        courtCount: courts.length,
        paid,
        unpaid,
        waived,
      });
    }

    const closedRows: SessionListRow[] = archive.map((record) => {
      const { paid, unpaid, waived } = tallyPayments(record.players);
      return {
        id: record.id,
        date: record.date,
        status: "CLOSED",
        playerCount: record.players.length,
        matchCount: record.matchCount,
        courtCount: record.courtCount,
        paid,
        unpaid,
        waived,
      };
    });

    return [...openRow, ...closedRows];
  }, [currentSession, archive, courts, queue, bench, matches]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Title bar */}
      <div
        className={cn(
          "sticky top-0 z-[var(--z-sticky)] bg-bg transition-shadow duration-200",
          headerShadow && "shadow-[0_1px_0_var(--color-border),0_2px_8px_oklch(0_0_0/0.08)]"
        )}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold text-ink">Sessions</h1>
            <span className="font-mono text-xs text-muted tabular-nums">
              ({rows.length})
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      {rows.length > 0 ? (
        <table className="w-full border-collapse" role="grid" aria-label="Session history">
          <thead className="sticky top-14 z-[var(--z-sticky)] bg-bg">
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted pl-4 sm:pl-6 pr-3 py-2.5 whitespace-nowrap">Date</th>
              <th className="text-left text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[84px]">Status</th>
              <th className="hidden sm:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[64px]">Players</th>
              <th className="hidden md:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[64px]">Matches</th>
              <th className="hidden md:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[64px]">Courts</th>
              <th className="hidden lg:table-cell text-left text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2.5 whitespace-nowrap">Payments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 transition-colors duration-100 hover:bg-surface-elevated/40">
                <td className="pl-4 sm:pl-6 pr-3 py-3">
                  <Link
                    href={`/sessions/${row.id}`}
                    className="text-sm font-medium text-ink hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {formatSessionDate(row.date)}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={row.status === "OPEN" ? "open" : "closed"} />
                </td>
                <td className="hidden sm:table-cell px-3 py-3 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted">{row.playerCount}</span>
                </td>
                <td className="hidden md:table-cell px-3 py-3 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted">{row.matchCount}</span>
                </td>
                <td className="hidden md:table-cell px-3 py-3 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted">{row.courtCount}</span>
                </td>
                <td className="hidden lg:table-cell pl-3 pr-4 sm:pr-6 py-3">
                  <PaymentSummary paid={row.paid} unpaid={row.unpaid} waived={row.waived} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="text-sm text-muted">No sessions yet</p>
          <p className="text-xs text-muted mt-1">Start your first session from the Dashboard.</p>
        </div>
      )}
    </div>
  );
}
