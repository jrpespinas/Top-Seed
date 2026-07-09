export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

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
