"use client";

import { formatElapsedMs, cn } from "@/lib/utils";
import { useTick } from "@/hooks/useTick";

// Fallback rule, used when no peer group is supplied (e.g. a match's own
// running duration, which has no peers to be compared against).
const ATTENTION_THRESHOLD_MS = 20 * 60 * 1000;

// Relative rule, used when a peer median IS supplied. A fixed 20-minute line is
// the wrong signal for "who has waited too long": in a congested session every
// player crosses it and the colour stops distinguishing anyone, while in a quiet
// one nobody crosses it even when someone has waited three times longer than the
// rest. Comparing against the queue's own median flags the genuine outlier at
// either pace. The floor stops it firing in the opening minutes, when a median
// of ~20s would make a 45s wait look alarming.
const RELATIVE_MULTIPLIER = 1.5;
const RELATIVE_FLOOR_MS = 5 * 60 * 1000;

export function ElapsedTimer({
  startedAtISO,
  className,
  ariaLabel,
  peerMedianStartedAtISO,
}: {
  startedAtISO: string;
  className?: string;
  /** Median start time of this timer's peer group, as a STABLE timestamp — not
   * a precomputed duration, which would drift the moment the clock moved on.
   * The threshold is derived here on each tick instead, so the parent never
   * needs to re-render to keep it accurate. */
  peerMedianStartedAtISO?: string;
  // Defaults to match-duration phrasing; pass a custom formatter for other
  // contexts (e.g. queue waiting time) so screen readers get accurate text.
  ariaLabel?: (elapsed: string, isLong: boolean) => string;
}) {
  const now = useTick();
  const elapsedMs = now - new Date(startedAtISO).getTime();

  const isLong = peerMedianStartedAtISO
    ? elapsedMs >=
      Math.max(
        RELATIVE_FLOOR_MS,
        RELATIVE_MULTIPLIER * (now - new Date(peerMedianStartedAtISO).getTime())
      )
    : elapsedMs >= ATTENTION_THRESHOLD_MS;
  const elapsed = formatElapsedMs(elapsedMs);
  const label = ariaLabel
    ? ariaLabel(elapsed, isLong)
    : `Match running for ${elapsed}${isLong ? " — running long" : ""}`;

  return (
    <time
      dateTime={startedAtISO}
      className={cn(className, isLong ? "text-warning font-semibold" : "text-muted")}
      aria-label={label}
    >
      {elapsed}
    </time>
  );
}
