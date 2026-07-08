"use client";

import { useState, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn, SKILL_LABELS } from "@/lib/utils";
import { SkillBadge } from "./SkillBadge";
import type { SkillLevel } from "@/types";

const SKILL_LEVELS: SkillLevel[] = ["S", "A", "B", "C", "D", "E", "F"];

export function SkillLevelSelect({
  value,
  onChange,
  className,
}: {
  value: SkillLevel;
  onChange: (level: SkillLevel) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<SkillLevel>(value);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const open = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setHighlighted(value);
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  const select = (level: SkillLevel) => {
    onChange(level);
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
    const idx = SKILL_LEVELS.indexOf(highlighted);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(SKILL_LEVELS[Math.min(idx + 1, SKILL_LEVELS.length - 1)]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(SKILL_LEVELS[Math.max(idx - 1, 0)]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(highlighted);
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
        aria-label="Skill level"
        className={cn(
          "flex items-center gap-1.5 bg-bg border border-border rounded-md pl-2.5 pr-2 py-2 text-sm text-ink min-w-0",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
          "transition-colors duration-150",
          className
        )}
      >
        <SkillBadge level={value} compact />
        <span className="truncate">{SKILL_LABELS[value]}</span>
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={cn("text-muted flex-shrink-0 ml-auto transition-transform duration-150", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Skill level"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: Math.max(position.width, 176),
            }}
            className="z-[var(--z-popover)] bg-surface border border-border rounded-md shadow-lg py-1 max-h-64 overflow-y-auto"
          >
            {SKILL_LEVELS.map((level) => (
              <div
                key={level}
                role="option"
                aria-selected={value === level}
                onMouseEnter={() => setHighlighted(level)}
                onClick={() => select(level)}
                className={cn(
                  "flex items-center gap-2 mx-1 px-2 py-2 rounded-md cursor-pointer text-sm text-ink",
                  "transition-colors duration-100",
                  level === highlighted && "bg-surface-elevated"
                )}
              >
                <SkillBadge level={level} />
                <span className="flex-1">{SKILL_LABELS[level]}</span>
                {value === level && (
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
