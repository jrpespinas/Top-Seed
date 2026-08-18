import type { SkillLevel } from "@/types";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";

// The classic metals ladder: Bronze -> Silver -> Gold -> Platinum.
//
// Chroma deliberately does NOT climb here — silver is less saturated than
// bronze, platinum less than gold — so unlike a rarity ramp the ordinal can't
// be read from saturation. It rests on cultural knowledge (everyone knows the
// order) plus LIGHTNESS, which climbs cleanly 0.66 -> 0.72 -> 0.80 -> 0.83.
// That's the more robust channel regardless: lightness survives every form of
// colour-vision deficiency, where hue and chroma do not.
//
// Fills are solid with plain `text-black` (Tailwind's built-in — the fill is a
// fixed value, so the label needs no token indirection). Every fill clears
// 6.7:1 under black.
//
// BORDERS USE -ink, NOT A TINT OF THE FILL. On this white canvas the platinum
// fill is only 1.66:1 against the background; a border tinted from its own
// fill would leave the badge with no visible edge at all. The darkened -ink
// variant gives ~7:1 on every tier. This is why those tokens exist.
const variants: Record<SkillLevel, string> = {
  ADVANCED: "bg-skill-advanced text-black border border-skill-advanced-ink/40",
  INTERMEDIATE: "bg-skill-intermediate text-black border border-skill-intermediate-ink/40",
  BEGINNER: "bg-skill-beginner text-black border border-skill-beginner-ink/40",
  CASUAL: "bg-skill-casual text-black border border-skill-casual-ink/40",
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
