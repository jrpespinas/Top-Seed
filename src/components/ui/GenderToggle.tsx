"use client";

import { cn } from "@/lib/utils";
import type { Gender } from "@/types";

export const GENDER_LABELS: Record<Gender, string> = { M: "Male", F: "Female" };

const GENDERS: Gender[] = ["M", "F"];

interface GenderToggleProps {
  value?: Gender;
  onChange: (gender: Gender | undefined) => void;
  variant?: "compact" | "full";
  className?: string;
}

export function GenderToggle({ value, onChange, variant = "full", className }: GenderToggleProps) {
  return (
    <div
      className={cn(
        variant === "compact" ? "flex items-center gap-1" : "grid grid-cols-2 gap-1.5",
        className
      )}
      role="radiogroup"
      aria-label="Gender"
    >
      {GENDERS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(value === g ? undefined : g)}
          className={cn(
            "flex items-center justify-center rounded-md font-medium transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            variant === "compact" ? "h-9 w-9 text-sm" : "h-10 text-sm",
            value === g
              ? "bg-surface-elevated text-ink border border-border ring-1 ring-primary/50"
              : "bg-surface-elevated text-muted hover:text-ink border border-transparent"
          )}
        >
          {variant === "compact" ? g : GENDER_LABELS[g]}
        </button>
      ))}
    </div>
  );
}
