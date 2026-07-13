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
  { href: "/players",     icon: Users,        label: "Players"     },
  { href: "/matches",     icon: Activity,     label: "Matches"     },
  { href: "/leaderboard", icon: Trophy,       label: "Rankings"    },
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
        "flex flex-col items-center justify-center gap-0.5 w-full min-h-[44px] py-2 rounded-md transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        active
          ? "bg-primary text-bg"
          : "text-muted hover:text-ink hover:bg-surface-elevated"
      )}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 1.75} aria-hidden />
      <span className="text-[9px] font-medium leading-none truncate max-w-full px-0.5">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col fixed left-0 top-0 bottom-0 bg-surface border-r border-border z-[var(--z-sticky)]",
        // Sidebar only ever renders at md:+ — an iPad, or a large iPhone
        // rotated to landscape (where the notch/Dynamic Island lands on the
        // left edge, not the top). Width grows by the same inset rather than
        // padding eating into the fixed 80px content area — otherwise a
        // ~44-59px landscape notch inset would squeeze this down to nearly
        // nothing. AppShell's md:ml-20 must match this width exactly.
        "w-[calc(5rem+env(safe-area-inset-left))] pl-[env(safe-area-inset-left)]",
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      )}
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

      {/* Theme toggle + settings pinned to bottom — Sessions lives here too now
          (moved out of the primary four), grouped with the other secondary
          destination rather than the day-to-day nav items above. */}
      <div className="px-2 pb-3 border-t border-border pt-3 flex flex-col gap-1">
        <ThemeToggle className="w-full min-h-[44px] justify-center" />
        <NavItem
          href="/sessions"
          icon={CalendarDays}
          label="Sessions"
          active={pathname.startsWith("/sessions")}
        />
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
