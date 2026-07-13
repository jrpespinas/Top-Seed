export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Hex mirrors of --color-bg-raw for each theme (globals.css) — the browser's
// <meta name="theme-color"> can't read CSS custom properties, so the app's
// canvas color needs a literal duplicate here. Single source of truth for
// both the inline pre-paint script (layout.tsx) and the manual toggle
// (ThemeToggle.tsx), which both need to update the tag when the theme is
// user-selected rather than OS-driven — keep in sync if --color-bg-raw ever
// changes.
export const THEME_COLOR: Record<"dark" | "light", string> = {
  dark: "#020202",
  light: "#ffffff",
};

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
  S: "Professional",
  A: "Advanced",
  B: "Upper Intermediate",
  C: "Intermediate",
  D: "Upper Beginner",
  E: "Beginner",
  F: "Newbie",
};

export const SKILL_LABELS_SHORT: Record<string, string> = {
  S: "Pro",
  A: "Adv",
  B: "Int+",
  C: "Int",
  D: "Beg+",
  E: "Beg",
  F: "New",
};
