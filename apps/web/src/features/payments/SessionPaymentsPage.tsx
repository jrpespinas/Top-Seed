import { useState } from "react";
import { useParams, useSearch } from "@tanstack/react-router";
import { useSessionPayments } from "../../hooks/useSessionPayments.js";
import { PlayerDetailDrawer } from "../players/PlayerDetailDrawer.js";
import { SessionWorkspaceShell } from "../dashboard/SessionWorkspaceShell.js";
import {
  PaymentList,
  PaymentSummaryPanel,
  SessionPaymentsFilters,
} from "./PaymentList.js";

export function SessionPaymentsPage() {
  const { sessionId } = useParams({ from: "/organizer/sessions/$sessionId/payments" });
  const search = useSearch({ from: "/organizer/sessions/$sessionId/payments" });
  const { session, checkIns, summary, sessionMode } = useSessionPayments(sessionId);
  const [statusFilter, setStatusFilter] = useState<string>(search.status ?? "all");
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);

  return (
    <SessionWorkspaceShell sessionId={sessionId} activeView="payments">
      {session && summary ? (
        <PaymentSummaryPanel
          session={session}
          summary={summary}
          checkIns={checkIns}
          sessionId={sessionId}
          mode="full"
        />
      ) : null}
      {session ? (
        <>
          <SessionPaymentsFilters statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
          <PaymentList
            session={session}
            checkIns={checkIns}
            sessionMode={sessionMode}
            statusFilter={statusFilter}
            onOpenPlayer={setSelectedCheckInId}
          />
        </>
      ) : null}
      <PlayerDetailDrawer
        sessionId={sessionId}
        checkInId={selectedCheckInId}
        isOpen={selectedCheckInId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCheckInId(null);
          }
        }}
        focusSection="payment"
      />
    </SessionWorkspaceShell>
  );
}
