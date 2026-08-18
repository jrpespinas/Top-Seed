export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Hex mirror of --color-bg-raw. The browser's <meta name="theme-color"> can't
// read CSS custom properties, so the canvas colour is duplicated here for the
// PWA/browser chrome. One value now that there's a single theme.
export const THEME_COLOR = "#fdfdff";

export function formatElapsedMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Pre-fill/fallback session name — time-of-day, not a counter, so it stays meaningful even when an organizer never touches the field. */
export function getDefaultSessionName(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Morning Session";
  if (hour < 17) return "Afternoon Session";
  return "Evening Session";
}

export const SKILL_LABELS: Record<string, string> = {
  ADVANCED: "Advanced",
  INTERMEDIATE: "Intermediate",
  BEGINNER: "Beginner",
  CASUAL: "Casual",
};

export const SKILL_LABELS_SHORT: Record<string, string> = {
  ADVANCED: "Adv",
  INTERMEDIATE: "Int",
  BEGINNER: "Beg",
  CASUAL: "Cas",
};
