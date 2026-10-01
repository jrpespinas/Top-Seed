import { cn } from "@/lib/utils";
import type { Honor, HonorKind } from "@/lib/leaderboard";

/**
 * Pieces of the Broadcast leaderboard, shared by the page, the Instagram story
 * and the print sheet so the three can't drift apart.
 *
 * The look borrows from TV sports graphics: bars and tags cut on a diagonal,
 * rank numbers in angled tabs, names in a condensed italic set in capitals.
 * Colour goes to the two things people want to find. The top three get
 * gold, silver and bronze rank tabs. Each award gets its own colour and icon,
 * like an achievement in a game, so over a few sessions people learn which
 * award someone won from the colour alone.
 */

const PODIUM_TAB: Record<1 | 2 | 3, string> = {
  1: "bg-podium-gold text-navy-deep",
  2: "bg-podium-silver text-ink",
  3: "bg-podium-bronze text-ink",
};

const PLACES: Record<1 | 2 | 3, string> = { 1: "1st place", 2: "2nd place", 3: "3rd place" };

export function isPodium(rank: number): rank is 1 | 2 | 3 {
  return rank === 1 || rank === 2 || rank === 3;
}

/**
 * Award colour and icon. Each kind keeps one colour everywhere it appears,
 * which is what lets the colour carry meaning on its own.
 */
export const AWARD_LOOK: Record<HonorKind, { bg: string; icon: string }> = {
  upset: { bg: "bg-award-giant", icon: "⚡" },
  streak: { bg: "bg-award-fire", icon: "🔥" },
  carry: { bg: "bg-award-carry", icon: "🤝" },
  onCourt: { bg: "bg-award-android", icon: "⏱️" },
  pair: { bg: "bg-award-duo", icon: "👥" },
};

/**
 * A rank in an angled tab. Gold, silver and bronze for the top three, and a
 * neutral tab below that. Size and padding come from the caller, since the
 * same tab appears at 44px on the podium and 13px in the table.
 */
export function RankTab({
  rank,
  className,
  neutral = "bg-surface-elevated text-muted",
}: {
  rank: number;
  className?: string;
  /** Classes for ranks 4 and below, which differ on dark and light grounds. */
  neutral?: string;
}) {
  const podium = isPodium(rank);
  return (
    <span
      className={cn(
        "bc-slant grid place-items-center font-display italic font-extrabold leading-none tabular-nums",
        podium ? PODIUM_TAB[rank] : neutral,
        className
      )}
      aria-label={podium ? PLACES[rank] : `Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

/** An award as a coloured, slanted tag naming its winner. */
export function AwardChip({
  honor,
  showDetail = true,
  className,
}: {
  honor: Honor;
  showDetail?: boolean;
  className?: string;
}) {
  const look = AWARD_LOOK[honor.kind];
  return (
    <span
      className={cn(
        "bc-slant [--slant:8px] inline-flex items-center gap-1.5 pl-2 pr-4 py-1",
        "font-display font-bold uppercase tracking-[0.05em] leading-none text-ink",
        look.bg,
        className
      )}
      title={`${honor.label}: ${honor.name}, ${honor.detail}`}
    >
      <span aria-hidden className="emoji normal-case">
        {look.icon}
      </span>
      <span>
        {honor.label} · {honor.name}
      </span>
      {showDetail && (
        <span className="normal-case tracking-normal font-semibold opacity-75">{honor.detail}</span>
      )}
    </span>
  );
}
