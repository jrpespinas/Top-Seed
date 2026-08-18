import type { SkillLevel } from "@/types";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";

// A rarity ladder, not a materials one (see the --color-skill-* tokens in
// globals.css): slate → teal → indigo → orchid. Chroma AND lightness both
// climb with rank, which is what keeps the ordinal readable at 9px and under
// red-green colour-vision deficiency — hue alone would carry neither. Metals
// were tried first and collide with this palette: the brand is copper (H38),
// so bronze is the same hue, gold neighbours the amber warning, and diamond
// neighbours the steel accent.
//
// The Filled Tier Rule: every level is a solid fill, not just the top ones — a
// real medal, not a tinted chip. Text is plain `text-black` (not the
// theme-relative `text-bg`, and not a CSS-variable token either — a newly-added
// Tailwind theme key needs a dev-server restart to take effect, and without it
// the class silently produces no rule at all), since the fill is fixed across
// both themes and pure black needs no indirection to stay correct.
//
// This was briefly outlined instead, to match a dark-themed reference app. It
// didn't survive contact with a dense light-themed list: outlining moves rank
// into a 1px border and 9px glyph strokes, roughly a quarter of the colored
// area of a fill and most of that in thin strokes. The badge's whole job is
// peripheral rank recognition down twenty rows, and area is what does that.
//
// --color-skill-*-ink still exists for anything that needs the tier color as
// *text* — the fills sit at OKLCH L 0.60–0.84, fine under black but ~1.5:1 as
// text on white, so that token darkens them under [data-theme="light"].
const variants: Record<SkillLevel, string> = {
  ADVANCED: "bg-skill-advanced text-black border border-skill-advanced/50",
  INTERMEDIATE: "bg-skill-intermediate text-black border border-skill-intermediate/50",
  BEGINNER: "bg-skill-beginner text-black border border-skill-beginner/50",
  CASUAL: "bg-skill-casual text-black border border-skill-casual/50",
};

export function SkillBadge({
  level,
  compact = false,
  dense = false,
  className,
}: {
  level: SkillLevel;
  compact?: boolean;
  /** Smaller box for dense contexts (a court card's stacked name-over-badge).
   * A real prop rather than a className override, because `cn` is a plain join
   * with no tailwind-merge — a passed-in `h-4` would lose to the base `h-5`
   * depending on Tailwind's own stylesheet order, not the attribute order. */
  dense?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm font-semibold whitespace-nowrap flex-shrink-0",
        dense ? "h-4 px-1 text-[9px]" : "h-5 px-1.5 text-[10px]",
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
