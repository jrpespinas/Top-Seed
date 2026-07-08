import { Mars, Venus } from "lucide-react";
import type { Gender } from "@/types";
import { cn } from "@/lib/utils";

const ICONS = { M: Mars, F: Venus } as const;
const COLORS = { M: "text-primary", F: "text-accent" } as const;
const LABELS = { M: "Male", F: "Female" } as const;

// Below this, the Mars/Venus glyph's arrow and cross strokes stop reading as
// distinct shapes and the icon degrades to an undifferentiated colored dot.
const MIN_LEGIBLE_SIZE = 14;

export function GenderIcon({
  gender,
  size = MIN_LEGIBLE_SIZE,
  className,
}: {
  gender: Gender;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[gender];
  return (
    <span title={LABELS[gender]} aria-label={LABELS[gender]} className="flex-shrink-0 inline-flex">
      <Icon
        size={Math.max(size, MIN_LEGIBLE_SIZE)}
        strokeWidth={2}
        className={cn(COLORS[gender], className)}
        aria-hidden
      />
    </span>
  );
}
