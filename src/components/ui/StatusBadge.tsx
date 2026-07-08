import { cn } from "@/lib/utils";

type StatusVariant =
  | "available"
  | "in-use"
  | "in-progress"
  | "completed"
  | "voided"
  | "open"
  | "closed"
  | "paid"
  | "unpaid"
  | "waived";

const variants: Record<StatusVariant, string> = {
  available:    "bg-success/15 text-success",
  "in-use":     "bg-accent/15 text-accent",
  "in-progress":"bg-accent/15 text-accent",
  completed:    "bg-surface-elevated text-muted",
  voided:       "bg-error/10 text-error",
  open:         "bg-primary/15 text-primary",
  closed:       "bg-surface-elevated text-muted",
  paid:         "bg-success/15 text-success",
  unpaid:       "bg-warning/15 text-warning",
  waived:       "bg-surface-elevated text-muted",
};

const labels: Record<StatusVariant, string> = {
  available:    "Available",
  "in-use":     "In Use",
  "in-progress":"In Progress",
  completed:    "Completed",
  voided:       "Voided",
  open:         "Open",
  closed:       "Closed",
  paid:         "Paid",
  unpaid:       "Unpaid",
  waived:       "Waived",
};

export function StatusBadge({
  status,
  className,
}: {
  status: StatusVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-medium tabular-nums",
        variants[status],
        className
      )}
    >
      {labels[status]}
    </span>
  );
}
