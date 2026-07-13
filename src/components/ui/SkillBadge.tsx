import type { SkillLevel } from "@/types";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";

// A named-tier material ladder (see the --color-skill-* tokens in
// globals.css): Newbie → Bronze → Silver → Gold → Emerald → Platinum →
// Diamond. Two reinforcing channels carry rank, not one — hue temperature
// (warm/muted low tiers → cool/vivid high tiers) AND fill weight (barely-
// there tint at the bottom → solid fill at the top).
//
// The Filled Tier Rule: S and A are solid fills with inverted (bg-color)
// text — unmistakably "filled," like a real medal, not a tinted chip. B
// through F stay unfilled (tinted background + colored text + border),
// fading toward nothing at F. Diluting "filled" across more than two tiers
// would make neither one read as elite.
const variants: Record<SkillLevel, string> = {
  S: "bg-skill-s text-bg border border-skill-s/50",
  A: "bg-skill-a/90 text-bg border border-skill-a/60",
  B: "bg-skill-b/30 text-skill-b border border-skill-b/40",
  C: "bg-skill-c/16 text-skill-c border border-skill-c/28",
  D: "bg-skill-d/10 text-skill-d border border-skill-d/20",
  E: "bg-skill-e/6 text-skill-e border border-skill-e/14",
  F: "bg-skill-f/3 text-skill-f border border-skill-f/8",
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
