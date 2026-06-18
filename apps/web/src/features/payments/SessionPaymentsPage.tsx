import { useState } from "react";
import { useParams, useSearch } from "@tanstack/react-router";
import { useSessionPayments } from "../../hooks/useSessionPayments.js";
import { PlayerDetailDrawer } from "../players/PlayerDetailDrawer.js";
import { SessionSyncBar } from "../sync/SessionSyncBar.js";
import {
  PaymentList,
  PaymentSummaryPanel,
  SessionPaymentsFilters,
  SessionPaymentsHeader,
} from "./PaymentList.js";

export function SessionPaymentsPage() {
  const { sessionId } = useParams({ from: "/organizer/sessions/$sessionId/payments" });
  const search = useSearch({ from: "/organizer/sessions/$sessionId/payments" });
  const { session, checkIns, summary, sessionMode } = useSessionPayments(sessionId);
  const [statusFilter, setStatusFilter] = useState<string>(search.status ?? "all");
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);

  if (!session) {
    return (
      <section className="rounded-card border border-border bg-surface p-6">
        <h1 className="text-heading font-semibold">Session not found</h1>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <SessionSyncBar sessionId={sessionId} />
      <SessionPaymentsHeader sessionId={sessionId} sessionName={session.name} />
      {summary ? (
        <PaymentSummaryPanel
          session={session}
          summary={summary}
          checkIns={checkIns}
          sessionId={sessionId}
          mode="full"
        />
      ) : null}
      <SessionPaymentsFilters statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
      <PaymentList
        session={session}
        checkIns={checkIns}
        sessionMode={sessionMode}
        statusFilter={statusFilter}
        onOpenPlayer={setSelectedCheckInId}
      />
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
    </div>
  );
}
