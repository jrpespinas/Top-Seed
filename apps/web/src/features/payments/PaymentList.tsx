import { Link } from "@tanstack/react-router";
import { PlayerRow } from "../../components/domain/player-row.js";
import { Button } from "../../components/ui/button.js";
import { ConfirmAction } from "../../components/ui/confirm-action.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { PaymentSummaryPanel } from "../dashboard/PaymentSummaryPanel.js";
import { applyPaymentTransition } from "../../lib/payment-actions.js";
import { updatePaymentLocal } from "../../mutations/updatePayment.js";
import type { LocalCheckIn, LocalSession } from "../../db/types.js";
import type { SessionMode } from "../../components/domain/types.js";
import type { PaymentStatus } from "@top-seed/domain";
import type { PaymentTransitionAction } from "@top-seed/domain";

const FILTER_TABS = ["all", "unpaid", "partial", "paid", "waived", "refunded"] as const;

export function PaymentList({
  session,
  checkIns,
  sessionMode,
  statusFilter,
  onOpenPlayer,
}: {
  session: LocalSession;
  checkIns: LocalCheckIn[];
  sessionMode: SessionMode;
  statusFilter: string;
  onOpenPlayer: (checkInId: string) => void;
}) {
  const filtered =
    statusFilter === "all"
      ? checkIns
      : checkIns.filter((checkIn) => checkIn.paymentStatus === statusFilter);

  if (filtered.length === 0) {
    return <EmptyState title="No players match this filter" />;
  }

  return (
    <ul className="divide-y divide-border rounded-card border border-border">
      {filtered.map((checkIn) => (
        <li key={checkIn.id} className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="flex-1 text-left" onClick={() => onOpenPlayer(checkIn.id)}>
              <PlayerRow
                player={{ id: checkIn.playerProfileId, displayName: checkIn.playerDisplayName }}
                variant="payment"
                payment={{
                  status: checkIn.paymentStatus as PaymentStatus,
                  amountDue: checkIn.paymentAmountDue,
                  amountPaid: checkIn.paymentAmountPaid,
                  currency: session.currency,
                }}
              />
            </button>
            {sessionMode === "live" ? (
              <PaymentRowActions
                sessionId={session.id}
                checkIn={checkIn}
                currency={session.currency}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PaymentRowActions({
  sessionId,
  checkIn,
}: {
  sessionId: string;
  checkIn: LocalCheckIn;
  currency: string;
}) {
  async function run(action: PaymentTransitionAction) {
    const payment = applyPaymentTransition(checkIn, action);
    await updatePaymentLocal({ sessionId, checkInId: checkIn.id, payment });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {(checkIn.paymentStatus === "unpaid" || checkIn.paymentStatus === "partial") && (
        <>
          <Button size="compact" variant="secondary" onClick={() => void run("mark_paid")}>
            Mark paid
          </Button>
          <Button size="compact" variant="ghost" onClick={() => void run("mark_waived")}>
            Waive
          </Button>
        </>
      )}
      {(checkIn.paymentStatus === "paid" || checkIn.paymentStatus === "partial") && (
        <ConfirmAction
          triggerLabel="Mark refunded"
          title="Mark refunded?"
          description="Recorded payment will count as refunded."
          onConfirm={() => run("mark_refunded")}
        />
      )}
      {checkIn.paymentStatus !== "unpaid" && (
        <ConfirmAction
          triggerLabel="Reset"
          title="Reset to unpaid?"
          description="Clears payment for this player."
          onConfirm={() => run("reset_to_unpaid")}
        />
      )}
    </div>
  );
}

export function SessionPaymentsFilters({
  statusFilter,
  onStatusFilterChange,
}: {
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}) {
  const filters = ["all", "unpaid", "partial", "paid", "waived", "refunded"] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((status) => (
        <button
          key={status}
          type="button"
          className={`rounded-control px-3 py-2 text-label ${
            statusFilter === status ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
          onClick={() => onStatusFilterChange(status)}
        >
          {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function SessionPaymentsHeader({
  sessionId,
  sessionName,
}: {
  sessionId: string;
  sessionName: string;
}) {
  return (
    <div>
      <Link to="/organizer/sessions/$sessionId/dashboard" params={{ sessionId }} className="text-caption text-primary">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-heading font-semibold">Payments · {sessionName}</h1>
    </div>
  );
}

export { PaymentSummaryPanel };
