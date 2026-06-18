import { cn } from "../../lib/cn.js";
import { formatMoney } from "../../lib/format/money.js";
import { formatPaymentStatus } from "../../lib/format/status-labels.js";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "waived" | "refunded";

export interface PaymentBadgeProps {
  status: PaymentStatus;
  amountDue?: number;
  amountPaid?: number;
  currency?: string;
  size?: "compact" | "default" | "large";
  isInteractive?: boolean;
  onClick?: () => void;
}

const tone: Record<PaymentStatus, string> = {
  unpaid: "bg-attention-surface text-attention border-attention/30",
  partial: "bg-attention-surface text-attention border-attention/30",
  paid: "bg-emerald-50 text-success border-success/30",
  waived: "bg-muted text-muted-foreground border-border",
  refunded: "bg-muted text-muted-foreground border-border",
};

export function PaymentBadge({
  status,
  amountDue,
  amountPaid,
  currency = "PHP",
  size = "default",
  isInteractive,
  onClick,
}: PaymentBadgeProps) {
  const label = formatPaymentStatus(status);
  const amountText =
    amountDue !== undefined
      ? status === "partial" && amountPaid !== undefined
        ? `${formatMoney(amountPaid, currency)} / ${formatMoney(amountDue, currency)}`
        : formatMoney(amountDue, currency)
      : null;

  const padding = size === "compact" ? "px-2 py-0.5 text-caption" : "px-2.5 py-1 text-caption";
  const className = cn(
    "inline-flex items-center gap-1 rounded-full border font-medium tabular-nums",
    padding,
    tone[status],
    isInteractive && "cursor-pointer hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  );

  const content = (
    <>
      <span>{label}</span>
      {amountText ? <span className="opacity-80">· {amountText}</span> : null}
    </>
  );

  if (isInteractive && onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={`${label} payment`}>
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}
