"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { TUTORIALS } from "@/lib/tutorial-store";

interface Props {
  onStartTutorial: (tutorialId: string) => void;
}

/**
 * The "?" entry point beside Close Session — lets the organizer (or a second
 * person sharing the device) replay any one tutorial chapter on its own,
 * instead of the only way back in being redoing the entire first-run chain.
 */
export function TutorialMenu({ onStartTutorial }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => setMounted(true), []);

  // Real APG menu keyboard behavior — this panel is portaled to the end of
  // document.body, so without moving focus in explicitly, Tab from the
  // trigger would walk every other focusable element on the Dashboard before
  // ever reaching these items. Focus the first item on open; Escape and
  // selecting an item both restore focus to the trigger, matching this
  // codebase's established confirm-swap focus convention elsewhere.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function closeMenu(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) btnRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      closeMenu(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu(true);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function handlePanelKeyDown(e: React.KeyboardEvent) {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    if (items.length === 0) return;
    const currentIndex = items.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Tutorials"
        aria-expanded={open}
        className="text-muted hover:text-ink hover:bg-surface-elevated transition-colors p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px] min-w-[36px] flex items-center justify-center"
      >
        <HelpCircle size={15} strokeWidth={1.75} aria-hidden />
      </button>
      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label="Tutorials"
            onKeyDown={handlePanelKeyDown}
            className="fixed z-[var(--z-popover)] w-56 bg-surface border border-border rounded-lg shadow-lg py-1.5 animate-tutorial-in"
            style={{ top: pos.top, right: pos.right }}
          >
            {TUTORIALS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  closeMenu(true);
                  onStartTutorial(t.id);
                }}
                className="w-full text-left text-sm text-ink px-3 py-2 hover:bg-surface-elevated focus-visible:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
              >
                {t.name}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
