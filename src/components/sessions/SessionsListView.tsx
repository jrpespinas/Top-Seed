"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatSessionDate } from "@/lib/utils";
import {
  useCurrentSession,
  useSessionArchive,
  useCourtsSnapshot,
  useQueueSnapshot,
  useBenchSnapshot,
  deleteArchivedSession,
} from "@/lib/session-store";
import { useMatchLog, removeMatchRecordsForSessions } from "@/lib/match-log-store";
import { useConfirmFocus } from "@/hooks/useConfirmFocus";
import type { PaymentStatus, Player } from "@/types";

function DeleteArchivedSessionButton({ sessionId }: { sessionId: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const { triggerRef, cancelRef } = useConfirmFocus(isConfirming);

  function handleConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    deleteArchivedSession(sessionId);
    removeMatchRecordsForSessions([sessionId]);
  }

  if (isConfirming) {
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={handleConfirm}
          aria-label="Confirm delete this session"
          className="p-1.5 text-error hover:bg-error/10 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error/40"
        >
          <Check size={13} strokeWidth={2.5} aria-hidden />
        </button>
        <button
          ref={cancelRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsConfirming(false);
          }}
          aria-label="Cancel delete"
          className="p-1.5 text-muted hover:text-ink hover:bg-surface-elevated rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
        >
          <X size={13} strokeWidth={2} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsConfirming(true);
        }}
        aria-label="Delete this archived session"
        className="p-1.5 text-muted opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-error hover:bg-error/10 rounded-sm transition-colors focus-visible:outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-error/40"
      >
        <Trash2 size={13} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

interface SessionListRow {
  id: string;
  name: string;
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
  const router = useRouter();
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
        name: currentSession.name,
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
        name: record.name,
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
          "sticky top-0 z-[var(--z-sticky)] transition-colors duration-200",
          // Dark mode reads elevation as surface lightness, not shadow color
          // (a black shadow blur is nearly invisible on a near-black bg) —
          // surface-elevated already IS this app's lighter-elevation step in
          // dark mode, and a legible tint-darker step in light mode, so one
          // token covers the "scrolled, lifted header" cue in both themes.
          headerShadow ? "bg-surface-elevated shadow-[0_1px_0_var(--color-border)]" : "bg-bg"
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
          <thead className={cn("sticky top-14 z-[var(--z-sticky)] transition-colors duration-200", headerShadow ? "bg-surface-elevated" : "bg-bg")}>
            <tr className="border-b border-border">
              <th scope="col" className="text-left text-xs font-medium text-muted pl-4 sm:pl-6 pr-3 py-2.5 whitespace-nowrap">Session</th>
              <th scope="col" className="text-left text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[84px]">Status</th>
              <th scope="col" className="hidden sm:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[64px]">Players</th>
              <th scope="col" className="hidden md:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[64px]">Matches</th>
              <th scope="col" className="hidden md:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 whitespace-nowrap w-[64px]">Courts</th>
              <th scope="col" className="hidden lg:table-cell text-left text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2.5 whitespace-nowrap">Payments</th>
              <th scope="col" className="text-right text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2.5 whitespace-nowrap w-[52px]">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/sessions/${row.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/sessions/${row.id}`);
                  }
                }}
                tabIndex={0}
                role="row"
                aria-label={`${row.name}, ${formatSessionDate(row.date)}, ${row.status === "OPEN" ? "open" : "closed"}`}
                className="group border-b border-border/50 cursor-pointer transition-colors duration-100 hover:bg-surface-elevated/40 focus-visible:outline-none focus-visible:bg-surface-elevated/40"
              >
                <td className="pl-4 sm:pl-6 pr-3 py-3">
                  <span className="block text-sm font-medium text-ink truncate max-w-[200px] sm:max-w-none">{row.name}</span>
                  <span className="block text-xs text-muted mt-0.5">{formatSessionDate(row.date)}</span>
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
                <td className="pl-3 pr-4 sm:pr-6 py-3">
                  {row.status === "CLOSED" && <DeleteArchivedSessionButton sessionId={row.id} />}
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
