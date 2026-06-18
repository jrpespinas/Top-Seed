import { cn } from "../../lib/cn.js";
import { Button } from "../ui/button.js";

export type MetricTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  tone?: MetricTone;
  actionLabel?: string;
  onAction?: () => void;
  isLoading?: boolean;
}

const toneClasses: Record<MetricTone, string> = {
  neutral: "border-border bg-surface",
  success: "border-success/30 bg-emerald-50",
  warning: "border-warning/30 bg-attention-surface",
  danger: "border-danger/30 bg-red-50",
  info: "border-primary/30 bg-primary/5",
};

export function MetricCard({
  label,
  value,
  description,
  tone = "neutral",
  actionLabel,
  onAction,
  isLoading,
}: MetricCardProps) {
  return (
    <div className={cn("rounded-card border px-4 py-3", toneClasses[tone])}>
      <p className="text-caption font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-display font-semibold tabular-nums text-foreground">
        {isLoading ? "…" : value}
      </p>
      {description ? <p className="mt-1 text-caption text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="ghost" size="compact" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
