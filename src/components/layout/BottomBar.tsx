"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Activity,
  CalendarDays,
  Trophy,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Same five destinations, same order, as Sidebar's primary nav — "shared
// item vocabulary" per DESIGN.md. Settings/ThemeToggle are the utility pair
// Sidebar pins below a divider; mirrored here as a narrower end segment
// rather than flex-1 slots, so they read as secondary without being hidden
// (this is the only nav surface below md:, so nothing here can be unreachable).
const items = [
  { href: "/",            icon: LayoutGrid,   label: "Dashboard"   },
  { href: "/sessions",    icon: CalendarDays, label: "Sessions"    },
  { href: "/players",     icon: Users,        label: "Players"     },
  { href: "/matches",     icon: Activity,     label: "Matches"     },
  { href: "/leaderboard", icon: Trophy,       label: "Rankings"    },
];

export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-[var(--z-sticky)]"
      aria-label="Mobile navigation"
    >
      <div className="flex h-[60px]">
        {items.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
                active ? "text-primary" : "text-muted"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} aria-hidden />
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">{label}</span>
            </Link>
          );
        })}

        <div className="w-px h-8 self-center bg-border flex-shrink-0" aria-hidden />

        <Link
          href="/settings"
          aria-label="Settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={cn(
            "w-12 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 min-h-[44px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
            pathname === "/settings" ? "text-primary" : "text-muted"
          )}
        >
          <Settings size={16} strokeWidth={pathname === "/settings" ? 2.5 : 1.75} aria-hidden />
          <span className="text-[9px] font-medium leading-none truncate max-w-full px-0.5">Settings</span>
        </Link>

        <ThemeToggle className="w-12 flex-shrink-0 justify-center min-h-[44px]" />
      </div>
    </nav>
  );
}
