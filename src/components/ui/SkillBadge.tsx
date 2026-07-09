import type { SkillLevel } from "@/types";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";

// One continuous hue arc (see the --color-skill-* tokens in globals.css) from
// cool steel-blue (F, matching --color-accent exactly) to warm copper (S,
// matching --color-primary exactly), stepping through teal/green/gold in
// between. Each letter gets its own hue AND the same increasing bg/border
// intensity toward S that the previous single-hue version used — rank reads
// through two reinforcing channels (color temperature + vividness), not one.
// The arc deliberately routes around the warning/error hues so a mid-tier
// chip never echoes "unpaid"/"error" a few columns over in the same table.
const variants: Record<SkillLevel, string> = {
  S: "bg-skill-s/24 text-skill-s border border-skill-s/40",
  A: "bg-skill-a/19 text-skill-a border border-skill-a/32",
  B: "bg-skill-b/15 text-skill-b border border-skill-b/26",
  C: "bg-skill-c/11 text-skill-c border border-skill-c/20",
  D: "bg-skill-d/8 text-skill-d border border-skill-d/15",
  E: "bg-skill-e/5 text-skill-e border border-skill-e/10",
  F: "bg-skill-f/3 text-skill-f border border-skill-f/6",
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
