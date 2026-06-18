import { cn } from "../../lib/cn.js";

export interface FilterChipOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterChipsProps {
  options: FilterChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterChips({ options, value, onChange, className }: FilterChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="tablist" aria-label="Filter players">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-caption font-medium transition-colors",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border/60 bg-surface text-muted-foreground hover:border-border hover:text-foreground",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.count !== undefined ? ` (${option.count})` : ""}
          </button>
        );
      })}
    </div>
  );
}
