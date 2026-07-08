"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Activity,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/",         icon: LayoutGrid,   label: "Dashboard" },
  { href: "/sessions", icon: CalendarDays, label: "Sessions"  },
  { href: "/matches",  icon: Activity,     label: "Matches"   },
  { href: "/players",  icon: Users,        label: "Players"   },
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
                active ? "text-primary" : "text-muted"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} aria-hidden />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
