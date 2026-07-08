"use client";

import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/types";

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
  WAIVED: "Waived",
};

const STATUSES: PaymentStatus[] = ["UNPAID", "PAID", "WAIVED"];

const activeClasses: Record<PaymentStatus, string> = {
  PAID: "bg-success/15 text-success",
  UNPAID: "bg-surface-elevated text-ink border border-border",
  WAIVED: "bg-primary/12 text-primary",
};

export function PaymentToggle({
  value,
  onChange,
  className,
}: {
  value: PaymentStatus;
  onChange: (status: PaymentStatus) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Payment status"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-bg p-0.5",
        className
      )}
    >
      {STATUSES.map((status) => {
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            title={PAYMENT_LABELS[status]}
            aria-label={PAYMENT_LABELS[status]}
            onClick={(e) => {
              e.stopPropagation();
              if (!active) onChange(status);
            }}
            className={cn(
              "flex items-center justify-center h-6 px-2 rounded-sm text-[10px] font-semibold whitespace-nowrap",
              "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              active ? activeClasses[status] : "text-muted hover:text-ink hover:bg-surface-elevated"
            )}
          >
            {PAYMENT_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
