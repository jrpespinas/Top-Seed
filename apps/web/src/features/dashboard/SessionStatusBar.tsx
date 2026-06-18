import { MetricCard } from "../../components/domain/metric-card.js";
import { formatMoney } from "../../lib/format/money.js";
import type { LocalSession } from "../../db/types.js";

export interface SessionStatusBarProps {
  session: LocalSession;
  metrics: {
    checkedIn: number;
    waiting: number;
    activeMatches: number;
    openCourts: number;
    unpaid: number;
    collected: number;
  };
  onFilterWaiting?: () => void;
  onFilterUnpaid?: () => void;
}

export function SessionStatusBar({
  session,
  metrics,
  onFilterWaiting,
  onFilterUnpaid,
}: SessionStatusBarProps) {
  return (
    <section className="flex gap-3 overflow-x-auto pb-1">
      <MetricCard label="Checked in" value={String(metrics.checkedIn)} />
      <MetricCard
        label="Waiting"
        value={String(metrics.waiting)}
        actionLabel="Show"
        onAction={onFilterWaiting}
      />
      <MetricCard label="Active matches" value={String(metrics.activeMatches)} />
      <MetricCard label="Open courts" value={String(metrics.openCourts)} />
      <MetricCard
        label="Unpaid"
        value={String(metrics.unpaid)}
        actionLabel="Show"
        onAction={onFilterUnpaid}
        tone={metrics.unpaid > 0 ? "warning" : "neutral"}
      />
      <MetricCard
        label="Collected"
        value={formatMoney(metrics.collected, session.currency)}
      />
    </section>
  );
}
