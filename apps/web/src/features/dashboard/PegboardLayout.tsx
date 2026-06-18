import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface PegboardLayoutProps {
  available: ReactNode;
  next: ReactNode;
  now: ReactNode;
  className?: string;
}

type ZoneVariant = "available" | "now" | "next";

function PegboardZone({
  title,
  variant,
  children,
}: {
  title: string;
  variant: ZoneVariant;
  children: ReactNode;
}) {
  const headerClass =
    variant === "now"
      ? "bg-court text-court-foreground"
      : variant === "next"
        ? "bg-next text-next-foreground"
        : "bg-muted text-foreground";

  return (
    <section
      aria-label={title}
      className="flex min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm"
    >
      <header className={cn("px-4 py-2.5 text-title font-semibold", headerClass)}>{title}</header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}

export function PegboardLayout({ available, next, now, className }: PegboardLayoutProps) {
  return (
    <div
      className={cn(
        "grid gap-4 lg:min-h-[70vh] lg:grid-cols-[minmax(220px,0.22fr)_minmax(280px,0.30fr)_minmax(400px,0.48fr)]",
        className,
      )}
    >
      <PegboardZone title="Available" variant="available">
        {available}
      </PegboardZone>
      <PegboardZone title="Next" variant="next">
        {next}
      </PegboardZone>
      <PegboardZone title="Now" variant="now">
        {now}
      </PegboardZone>
    </div>
  );
}
