import { Link } from "@tanstack/react-router";
import { PlayerRow } from "../../components/domain/player-row.js";
import { Button } from "../../components/ui/button.js";
import { formatMoney } from "../../lib/format/money.js";
import type { LocalCheckIn, LocalSession } from "../../db/types.js";
import type { PaymentSummary } from "@top-seed/domain";

export function PaymentSummaryPanel({
  session,
  summary,
  checkIns,
  sessionId,
}: {
  session: LocalSession;
  summary: PaymentSummary | null;
  checkIns: LocalCheckIn[];
  sessionId: string;
}) {
  const unpaidPreview = checkIns
    .filter((checkIn) => checkIn.paymentStatus === "unpaid" || checkIn.paymentStatus === "partial")
    .slice(0, 5);

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
        <p className="mt-2 text-body text-muted-foreground">
          Collected {formatMoney(summary.collectedTotal, summary.currency)} of{" "}
          {formatMoney(summary.expectedTotal, summary.currency)}
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-border">
        {unpaidPreview.map((checkIn) => (
          <li key={checkIn.id}>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
