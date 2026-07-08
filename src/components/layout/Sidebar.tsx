"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Activity,
  Trophy,
  CalendarDays,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navItems = [
  { href: "/",            icon: LayoutGrid,   label: "Dashboard"   },
  { href: "/sessions",    icon: CalendarDays, label: "Sessions"    },
  { href: "/players",     icon: Users,        label: "Players"     },
  { href: "/matches",     icon: Activity,     label: "Matches"     },
  { href: "/leaderboard", icon: Trophy,       label: "Leaderboard" },
];

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 w-full py-2 rounded-md transition-colors duration-150",
        active
          ? "bg-primary text-bg"
          : "text-muted hover:text-ink hover:bg-surface-elevated"
      )}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 1.75} aria-hidden />
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-20 bg-surface border-r border-border z-[var(--z-sticky)]"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-border flex-shrink-0">
        <span
          className="text-primary font-bold text-lg tracking-tight select-none"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          TS
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 py-3 px-2 overflow-y-auto">
        {navItems.map(({ href, icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <NavItem key={href} href={href} icon={icon} label={label} active={active} />
          );
        })}
      </nav>

      {/* Theme toggle + settings pinned to bottom */}
      <div className="px-2 pb-3 border-t border-border pt-3 flex flex-col gap-1">
        <ThemeToggle />
        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          active={pathname === "/settings"}
        />
      </div>
    </aside>
  );
}
