import { Link } from "@tanstack/react-router";
import { MetricCard } from "../../components/domain/metric-card.js";
import { PlayerRow } from "../../components/domain/player-row.js";
import { Button } from "../../components/ui/button.js";
import { formatMoney } from "../../lib/format/money.js";
import { applyPaymentTransition } from "../../lib/payment-actions.js";
import { updatePaymentLocal } from "../../mutations/updatePayment.js";
import type { LocalCheckIn, LocalSession } from "../../db/types.js";
import type { PaymentSummary } from "@top-seed/domain";
import type { SessionMode } from "../../components/domain/types.js";

export function PaymentSummaryPanel({
  session,
  summary,
  checkIns,
  sessionId,
  mode = "compact",
  sessionMode = "live",
}: {
  session: LocalSession;
  summary: PaymentSummary | null;
  checkIns: LocalCheckIn[];
  sessionId: string;
  mode?: "compact" | "full";
  sessionMode?: SessionMode;
}) {
  const unpaidPreview = checkIns
    .filter((checkIn) => checkIn.paymentStatus === "unpaid" || checkIn.paymentStatus === "partial")
    .slice(0, 5);

  async function markPaid(checkIn: LocalCheckIn) {
    const payment = applyPaymentTransition(checkIn, "mark_paid");
    await updatePaymentLocal({ sessionId, checkInId: checkIn.id, payment });
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title font-semibold">Payments</h2>
        <Link to="/organizer/sessions/$sessionId/payments" params={{ sessionId }}>
          <Button variant="ghost" size="compact">
            View all
          </Button>
        </Link>
      </div>
      {summary ? (
        mode === "full" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Expected" value={formatMoney(summary.expectedTotal, summary.currency)} />
            <MetricCard label="Collected" value={formatMoney(summary.collectedTotal, summary.currency)} tone="success" />
            <MetricCard label="Unpaid" value={formatMoney(summary.unpaidTotal, summary.currency)} tone={summary.unpaidTotal > 0 ? "warning" : "neutral"} />
            <MetricCard label="Waived" value={formatMoney(summary.waivedTotal, summary.currency)} />
            <MetricCard label="Refunded" value={formatMoney(summary.refundedTotal, summary.currency)} />
            <MetricCard
              label="Counts"
              value={`${summary.countsByStatus.unpaid} unpaid · ${summary.countsByStatus.paid} paid`}
              description={`${summary.countsByStatus.partial} partial · ${summary.countsByStatus.waived} waived · ${summary.countsByStatus.refunded} refunded`}
            />
          </div>
        ) : (
          <p className="mt-2 text-body text-muted-foreground">
            Collected {formatMoney(summary.collectedTotal, summary.currency)} of{" "}
            {formatMoney(summary.expectedTotal, summary.currency)}
          </p>
        )
      ) : null}
      {mode === "compact" ? (
        <ul className="mt-3 divide-y divide-border">
          {unpaidPreview.map((checkIn) => (
            <li key={checkIn.id} className="flex items-center justify-between gap-2 py-1">
              <PlayerRow
                player={{ id: checkIn.playerProfileId, displayName: checkIn.playerDisplayName }}
                variant="payment"
                payment={{
                  status: checkIn.paymentStatus as "unpaid",
                  amountDue: checkIn.paymentAmountDue,
                  amountPaid: checkIn.paymentAmountPaid,
                  currency: session.currency,
                }}
              />
              {sessionMode === "live" ? (
                <Button size="compact" variant="secondary" onClick={() => void markPaid(checkIn)}>
                  Mark paid
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
