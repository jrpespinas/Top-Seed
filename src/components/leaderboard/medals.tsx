import { cn } from "@/lib/utils";

const MEDALS: Record<1 | 2 | 3, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PLACES: Record<1 | 2 | 3, string> = { 1: "1st place", 2: "2nd place", 3: "3rd place" };

export function hasMedal(rank: number): rank is 1 | 2 | 3 {
  return rank === 1 || rank === 2 || rank === 3;
}

/**
 * A podium medal, standing in for the rank numeral.
 *
 * The rank frames still avoid gold, silver and bronze. The skill badges already
 * use those metals inside the same cards, and a gold *frame* would read as a
 * tier. An emoji medal doesn't have that problem: it reads as a medal, which
 * means placing. The glyph gets `role="img"` and a spoken place, because emoji
 * names are announced inconsistently across screen readers.
 */
export function Medal({ rank, className }: { rank: 1 | 2 | 3; className?: string }) {
  return (
    <span role="img" aria-label={PLACES[rank]} className={cn("emoji leading-none", className)}>
      {MEDALS[rank]}
    </span>
  );
}

/**
 * The single emblem shared by every special award.
 *
 * Awards used to carry one icon per kind (a bolt, a flame and so on). The star
 * makes them read as one family at a glance, separate from the podium's
 * medals. The award's name ("Giant Killer", "On Fire") already says which kind
 * it is.
 */
export function AwardStar({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("emoji leading-none", className)}>
      ⭐
    </span>
  );
}
