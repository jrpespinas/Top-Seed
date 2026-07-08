import type { SkillLevel } from "@/types";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";

const variants: Record<SkillLevel, string> = {
  S: "bg-primary/20 text-primary border border-primary/30",
  A: "bg-primary/12 text-primary/80",
  B: "bg-accent/12 text-accent",
  C: "bg-ink/8 text-ink/60",
  D: "bg-ink/6 text-muted border border-border/50",
  E: "bg-ink/4 text-muted",
  F: "text-muted border border-border/30",
};

export function SkillBadge({
  level,
  compact = false,
  className,
}: {
  level: SkillLevel;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-1.5 rounded-sm text-[10px] font-semibold whitespace-nowrap flex-shrink-0",
        variants[level],
        className
      )}
      title={SKILL_LABELS[level]}
      aria-label={`Skill: ${SKILL_LABELS[level]}`}
    >
      {compact ? SKILL_LABELS_SHORT[level] : SKILL_LABELS[level]}
    </span>
  );
}
