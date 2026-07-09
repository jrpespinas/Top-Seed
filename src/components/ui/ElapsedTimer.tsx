"use client";

import { formatElapsedMs, cn } from "@/lib/utils";
import { useTick } from "@/hooks/useTick";

// Past this duration, whatever this timer represents (a match running long, a
// player waiting a long time) is worth an organizer's attention during a fast scan.
const ATTENTION_THRESHOLD_MS = 20 * 60 * 1000;

export function ElapsedTimer({
  startedAtISO,
  className,
  ariaLabel,
}: {
  startedAtISO: string;
  className?: string;
  // Defaults to match-duration phrasing; pass a custom formatter for other
  // contexts (e.g. queue waiting time) so screen readers get accurate text.
  ariaLabel?: (elapsed: string, isLong: boolean) => string;
}) {
  const now = useTick();
  const elapsedMs = now - new Date(startedAtISO).getTime();

  const isLong = elapsedMs >= ATTENTION_THRESHOLD_MS;
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
