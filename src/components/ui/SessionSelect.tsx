"use client";

import { useState, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, CalendarDays } from "lucide-react";
import { cn, formatSessionDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { SessionOption } from "@/lib/session-store";

// Portal-rendered combobox mirroring SkillLevelSelect.tsx's pattern (fixed
// positioning escapes a sticky header's stacking context, full keyboard nav).
// Shared by Leaderboard and Matches — both scope their data to one session
// via useSessionOptions() and hand its result straight to this component.
export function SessionSelect({
  sessions,
  value,
  onChange,
}: {
  sessions: SessionOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(value);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = sessions.find((s) => s.id === value) ?? null;

  const open = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // This trigger now lives in the header's upper-right corner, so a
      // strictly left-anchored panel regularly runs past the viewport's
      // right edge. Clamp so the panel's right edge stays on-screen instead.
      const panelWidth = Math.max(rect.width, 220);
      const maxLeft = window.innerWidth - panelWidth - 8;
      const left = Math.min(rect.left, Math.max(maxLeft, 8));
      setPosition({ top: rect.bottom + 4, left, width: rect.width });
    }
    setHighlighted(value);
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  const select = (id: string) => {
    onChange(id);
    close();
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        open();
      }
      return;
    }
    const idx = sessions.findIndex((s) => s.id === highlighted);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(sessions[Math.min(idx + 1, sessions.length - 1)]?.id ?? highlighted);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(sessions[Math.max(idx - 1, 0)]?.id ?? highlighted);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlighted) select(highlighted);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      triggerRef.current?.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label="Session"
        className={cn(
          "flex items-center gap-1.5 bg-surface border border-border rounded-md pl-2.5 pr-2 h-10 text-sm text-ink min-w-0 flex-shrink-0",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
          "transition-colors duration-150"
        )}
      >
        <CalendarDays size={13} strokeWidth={2} className="text-muted flex-shrink-0" aria-hidden />
        <span className="truncate max-w-[88px] sm:max-w-[180px]">
          {selected ? selected.label : "Select session"}
        </span>
        {selected?.isOpen && (
          <>
            {/* Full badge at sm+; a compact dot on mobile so "which session am I
                on" doesn't require reopening the dropdown to find out. */}
            <span
              className="sm:hidden w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"
              aria-hidden
            />
            <StatusBadge status="open" className="hidden sm:inline-flex flex-shrink-0" />
          </>
        )}
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={cn("text-muted flex-shrink-0 ml-0.5 transition-transform duration-150", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Session"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: Math.max(position.width, 220),
            }}
            className="z-[var(--z-popover)] bg-surface border border-border rounded-md shadow-lg py-1 max-h-72 overflow-y-auto"
          >
            {sessions.map((s) => (
              <div
                key={s.id}
                role="option"
                aria-selected={value === s.id}
                onMouseEnter={() => setHighlighted(s.id)}
                onClick={() => select(s.id)}
                className={cn(
                  "flex items-center gap-2 mx-1 px-2 py-2 rounded-md cursor-pointer text-sm text-ink",
                  "transition-colors duration-100",
                  s.id === highlighted && "bg-surface-elevated"
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{s.label}</span>
                  <span className="block text-xs text-muted truncate">{formatSessionDate(s.date)}</span>
                </span>
                {s.isOpen && <StatusBadge status="open" className="flex-shrink-0" />}
                {value === s.id && (
                  <Check size={14} strokeWidth={2.5} className="text-primary flex-shrink-0" aria-hidden />
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
