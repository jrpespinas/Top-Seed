"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuPoint = { x: number; y: number };

/**
 * Which player was asked about, and where they were when it happened. The
 * place decides the menu's actions, so it travels with the request rather
 * than being re-derived from the player id.
 */
export type PlayerMenuTarget =
  | { where: "pool"; playerId: string }
  | { where: "card"; playerId: string; cardId: string; side: "A" | "B"; index: number }
  | { where: "court"; playerId: string };

export interface PlayerMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

/** Hold time before a touch counts as a long-press. */
const LONG_PRESS_MS = 450;
/** A finger drifting further than this is scrolling or dragging, not holding. */
const LONG_PRESS_SLOP_PX = 8;
const MENU_WIDTH = 184;

// Layout effect in the browser, plain effect during server rendering, where a
// layout effect does nothing but log a warning. The menu never renders on the
// server anyway: it waits for `mounted`.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const VIEWPORT_GUTTER = 8;

/**
 * Stops iOS showing its own copy/lookup callout and selecting the name text
 * when someone long-presses a player to open this menu.
 */
export const NO_TOUCH_CALLOUT = "select-none [-webkit-touch-callout:none]";

/**
 * Right-click and long-press, both opening the same player menu.
 *
 * Tap is already taken on every surface that uses this (it selects a player
 * for swapping), so the menu can't live on tap. Right-click covers a mouse;
 * long-press is its touch equivalent. Neither is discoverable on its own,
 * which is why every player also gets a visible ⋯ button (PlayerMoreButton).
 * These two are shortcuts, not the way in.
 *
 * After a long-press fires, the tap that ends it must not also select the
 * player for a swap, so `onClickCapture` swallows exactly one click.
 * `cancel` is for the element's own onDragStart: a drag that begins mid-hold
 * is a drag, not a menu request.
 */
export function usePlayerMenuTrigger(onOpen: (point: MenuPoint) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<MenuPoint | null>(null);
  const suppressClick = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const triggerProps = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      cancel();
      onOpen({ x: e.clientX, y: e.clientY });
    },
    onPointerDown: (e: React.PointerEvent) => {
      // Mouse users have right-click; a held left button is a drag.
      if (e.pointerType === "mouse") return;
      suppressClick.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      const point = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        suppressClick.current = true;
        onOpen(point);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current) return;
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e: React.MouseEvent) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return { triggerProps, cancel };
}

/**
 * The visible way into the player menu.
 *
 * Always shown on touch screens, where there's no hover and a hidden control
 * may as well not exist; revealed on hover with a mouse, where right-click
 * also works, so the row stays calm until you reach for it. Mirrors how the
 * × on a matchup chip already behaves.
 */
export function PlayerMoreButton({
  playerName,
  onOpen,
  groupName,
  className,
}: {
  playerName: string;
  onOpen: (point: MenuPoint) => void;
  /** The Tailwind `group/<name>` of the row this sits in, for hover reveal. */
  groupName: "chip" | "courtrow";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        onOpen({ x: r.left, y: r.bottom + 4 });
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={`More actions for ${playerName}`}
      aria-haspopup="menu"
      className={cn(
        "flex items-center justify-center h-5 w-5 rounded-sm text-muted",
        "hover:text-ink hover:bg-surface-elevated transition-[opacity,colors]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:opacity-100",
        "[@media(hover:none)]:opacity-100",
        groupName === "chip"
          ? "opacity-0 group-hover/chip:opacity-100"
          : "opacity-0 group-hover/courtrow:opacity-100",
        className
      )}
    >
      <Ellipsis size={13} strokeWidth={2.25} aria-hidden />
    </button>
  );
}

export function PlayerMenu({
  point,
  title,
  items,
  onClose,
}: {
  /** Null when closed. */
  point: MenuPoint | null;
  title: string;
  items: PlayerMenuItem[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<MenuPoint | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => setMounted(true), []);

  // Clamped to the viewport once the menu's real height is known, flipping
  // above the pointer when there's no room below. Near the bottom of a court
  // card on a phone, opening straight down would push half the menu off-screen.
  useIsomorphicLayoutEffect(() => {
    if (!point || !menuRef.current) {
      setPos(null);
      return;
    }
    // Remember who had focus so closing from the keyboard puts it back there.
    // Captured here, before focus moves into the menu below. A separate
    // useEffect would run after this layout effect and record the menu item.
    if (!menuRef.current.contains(document.activeElement)) {
      returnFocusTo.current = document.activeElement;
    }
    const h = menuRef.current.offsetHeight;
    const x = Math.min(Math.max(VIEWPORT_GUTTER, point.x), window.innerWidth - MENU_WIDTH - VIEWPORT_GUTTER);
    const fitsBelow = point.y + h + VIEWPORT_GUTTER <= window.innerHeight;
    const y = fitsBelow ? point.y : Math.max(VIEWPORT_GUTTER, point.y - h);
    setPos({ x, y });
    menuRef.current.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [point, items.length]);

  const close = useCallback(
    (restoreFocus: boolean) => {
      onClose();
      if (restoreFocus && returnFocusTo.current instanceof HTMLElement) returnFocusTo.current.focus();
    },
    [onClose]
  );

  useEffect(() => {
    if (!point) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") {
        e.preventDefault();
        close(true);
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
      const i = nodes.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
      nodes[next]?.focus();
    };
    // A menu left floating while the page scrolls points at the wrong player.
    const onScroll = () => close(false);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [point, close]);

  if (!mounted || !point) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={title}
      style={{
        position: "fixed",
        left: pos?.x ?? point.x,
        top: pos?.y ?? point.y,
        width: MENU_WIDTH,
        // Measured invisibly first, so it never flashes at an unclamped spot.
        visibility: pos ? "visible" : "hidden",
      }}
      className="z-[var(--z-popover)] bg-surface border border-border rounded-md shadow-lg py-1 animate-tutorial-in"
    >
      <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-muted truncate">{title}</p>
      {items.map(({ key, label, icon: Icon, onSelect, danger }) => (
        <button
          key={key}
          type="button"
          role="menuitem"
          onClick={() => {
            close(false);
            onSelect();
          }}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
            "focus-visible:outline-none focus:bg-surface-elevated hover:bg-surface-elevated",
            danger ? "text-error" : "text-ink"
          )}
        >
          {Icon && <Icon size={14} strokeWidth={2} className="flex-shrink-0 opacity-80" aria-hidden />}
          {label}
        </button>
      ))}
    </div>,
    document.body
  );
}
