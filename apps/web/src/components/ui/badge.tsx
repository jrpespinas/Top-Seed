import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export type BadgeVariant = "default" | "secondary" | "outline" | "next" | "court" | "attention";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-foreground text-background",
  secondary: "bg-muted text-foreground",
  outline: "border border-border bg-surface text-foreground",
  next: "bg-next/15 text-next",
  court: "bg-court/10 text-court",
  attention: "bg-attention-surface text-attention",
};

export function Badge({ className, children, variant = "secondary", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
