"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { cn, THEME_COLOR } from "@/lib/utils";

type Theme = "dark" | "light";

const STORAGE_KEY = "ts-theme";

// The inline pre-paint script in layout.tsx sets this on first load; this
// keeps it correct after that, whenever the theme changes post-hydration
// (manual toggle or a live OS preference change with no stored override).
function syncMetaThemeColor(theme: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial =
      stored ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setThemeState(initial);
    setMounted(true);

    const mql = matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t: Theme = e.matches ? "light" : "dark";
        document.documentElement.dataset.theme = t;
        syncMetaThemeColor(t);
        setThemeState(t);
      }
    };
    mql.addEventListener("change", onSystemChange);
    return () => mql.removeEventListener("change", onSystemChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const html = document.documentElement;
    html.classList.add("theme-switching");
    html.dataset.theme = next;
    localStorage.setItem(STORAGE_KEY, next);
    syncMetaThemeColor(next);
    setThemeState(next);
    setTimeout(() => html.classList.remove("theme-switching"), 250);
  };

  if (!mounted) {
    return (
      <div
        className={cn("flex flex-col items-center gap-0.5 py-2 rounded-md", className)}
        aria-hidden
      />
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 rounded-md",
        "text-muted hover:text-ink hover:bg-surface-elevated",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
    >
      {theme === "dark" ? (
        <Sun size={16} strokeWidth={1.75} aria-hidden />
      ) : (
        <Moon size={16} strokeWidth={1.75} aria-hidden />
      )}
      <span className="text-[9px] font-medium leading-none">
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
