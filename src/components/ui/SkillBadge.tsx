import type { SkillLevel } from "@/types";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";

// A named-tier material ladder (see the --color-skill-* tokens in
// globals.css): Newbie → Bronze → Silver → Gold → Emerald → Platinum →
// Diamond. Rank reads through color identity alone — hue temperature and
// chroma climb from muted/warm at the bottom to vivid/cool at the top —
// since every tier now shares the same fill treatment.
//
// The Filled Tier Rule: every level is a solid fill, not just the top ones —
// a real medal, not a tinted chip, at every rank. Fading a low tier down to
// a near-invisible tint read as "forgot to color this one" rather than
// "deliberately restrained," so all seven are equally filled and let hue/
// chroma alone carry the ladder. Text is plain `text-black` — not the
// theme-relative `text-bg`, and not a custom CSS-variable token either
// (a prior version used one; a newly-added Tailwind theme key needs a dev
// server restart to take effect, and without it the class silently produced
// no rule at all) — since the fill itself is fixed across both themes (see
// the globals.css comment), pure black needs no indirection to stay correct.
const variants: Record<SkillLevel, string> = {
  S: "bg-skill-s text-black border border-skill-s/50",
  A: "bg-skill-a text-black border border-skill-a/50",
  B: "bg-skill-b text-black border border-skill-b/50",
  C: "bg-skill-c text-black border border-skill-c/50",
  D: "bg-skill-d text-black border border-skill-d/50",
  E: "bg-skill-e text-black border border-skill-e/50",
  F: "bg-skill-f text-black border border-skill-f/50",
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
