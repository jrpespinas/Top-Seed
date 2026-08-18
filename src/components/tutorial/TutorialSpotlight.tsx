"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(selector: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tutorial-target="${selector}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

interface PrimaryAction {
  label: string;
  onClick: () => void;
}

interface TutorialSpotlightProps {
  targetSelector: string;
  title: string;
  body: string;
  /** "Step 2 of 3" style label — set only in manual replay mode. */
  progressLabel?: string;
  /** "Got it" (acknowledge-only steps) or "Next"/"Done" (manual replay). Omitted for gated steps, which advance on their own. */
  primaryAction?: PrimaryAction;
  onBack?: () => void;
  /** Gated steps only — move on without waiting for the real action. */
  onSkipStep?: () => void;
  onClose: () => void;
}

const CALLOUT_WIDTH = 288;
const GAP = 12;
const RING_PADDING = 6;
const VIEWPORT_MARGIN = 12;
// Toast.tsx anchors at bottom-[76px] (mobile) with its own ~40px height, so
// its top edge sits roughly 116px up from the viewport bottom. z-tooltip (60)
// already outranks z-toast (50), so an overlapping callout would visually
// win — but two of this tutorial's own gated steps (Assign to court, FIFO
// return) fire the instant an action that also raises an undo toast
// completes, making that overlap a real, not hypothetical, case. Reserving
// this much clearance in the "is there room below the target" check means
// the existing flip-to-above logic naturally steers clear of the toast too,
// with no need to know whether one is actually showing.
const TOAST_CLEARANCE = 116;

export function TutorialSpotlight({
  targetSelector,
  title,
  body,
  progressLabel,
  primaryAction,
  onBack,
  onSkipStep,
  onClose,
}: TutorialSpotlightProps) {
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  // Tracks the target across scroll/resize/layout shifts (e.g. a matchup
  // card list re-flowing as cards are added) without needing to enumerate
  // every scrollable ancestor — a single rAF poll catches all of them. The
  // functional setState form bails out of a re-render when the rect hasn't
  // actually changed, so this is a lot cheaper than it looks.
  useEffect(() => {
    function tick() {
      const next = measure(targetSelector);
      setRect((prev) => (sameRect(prev, next) ? prev : next));
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [targetSelector]);

  // Escape closes — this is non-modal (no backdrop, the rest of the UI stays
  // interactive), so it deliberately never steals focus to announce itself
  // (role="status" + aria-live below does that instead, matching Toast.tsx's
  // own precedent for a live region that still contains an interactive
  // control). Escape is still the expected dismiss key regardless of role,
  // and its sibling TutorialMenu already honors it, so this should too.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!mounted) return null;

  // A target can be legitimately absent — its precondition just hasn't
  // happened yet (e.g. "assign to court" only exists once a card is ready
  // and a court is free). Previously this returned null outright, taking the
  // step's own close/skip controls down with it and leaving no way out
  // short of finding the unrelated "?" menu by accident. Now the callout
  // always renders once mounted; only the ring (which needs a real rect to
  // anchor to) is conditional. No ring + a neutral dashed border communicates
  // "waiting," as distinct from the primary-colored border an active target
  // gets.
  const hasTarget = !!rect;

  const ringStyle: React.CSSProperties | undefined = rect
    ? {
        top: rect.top - RING_PADDING,
        left: rect.left - RING_PADDING,
        width: rect.width + RING_PADDING * 2,
        height: rect.height + RING_PADDING * 2,
      }
    : undefined;

  // Anchored below the target by default, flipping above when there isn't
  // room below (and there is above) — bottom-anchored in that case so the
  // callout's own (unmeasured) height never has to be guessed at. With no
  // target, position falls through to Tailwind classes below instead of
  // inline coordinates (see the fallback className) — a fixed corner needs
  // no per-render computation, and expressing it as classes lets it carry a
  // responsive md: variant, which an inline style object can't.
  let calloutStyle: React.CSSProperties = {};
  if (rect) {
    const spaceBelow = window.innerHeight - TOAST_CLEARANCE - (rect.top + rect.height);
    const placeAbove = spaceBelow < 180 && rect.top > 180;
    const rawLeft = rect.left + rect.width / 2 - CALLOUT_WIDTH / 2;
    const left = Math.min(
      Math.max(rawLeft, VIEWPORT_MARGIN),
      window.innerWidth - CALLOUT_WIDTH - VIEWPORT_MARGIN
    );
    calloutStyle = placeAbove
      ? { bottom: window.innerHeight - rect.top + GAP, left }
      : { top: rect.top + rect.height + GAP, left };
  }

  return createPortal(
    <>
      {ringStyle && (
        <div
          aria-hidden
          // Dashed + accent (violet), not a solid primary ring —
          // primary-colored rings already mean three different interactive
          // states elsewhere in this app (CourtCard's confirm-pending and
          // drop-target/drag-over rings, PlayerChip's drag-over ring), and
          // several of those can render on the exact element a tutorial step
          // is spotlighting at the same time (e.g. mid-relocate, or
          // mid-substitute onto a live match). A different hue AND a
          // different shape means the distinction never rests on color
          // alone.
          className="fixed z-[var(--z-tooltip)] rounded-md border-2 border-dashed border-accent pointer-events-none animate-tutorial-pulse motion-reduce:animate-none"
          style={ringStyle}
        />
      )}
      <div
        role="status"
        aria-label={title}
        aria-live="polite"
        className={cn(
          "fixed z-[var(--z-tooltip)] rounded-lg border bg-surface shadow-lg p-4",
          // Matches the ring's accent hue, not primary — the two render
          // together as one tutorial moment, and buttons inside (which
          // legitimately stay primary, this app's one real "press me" color)
          // already carry that meaning; the frame around the whole thing
          // shouldn't compete with them for it.
          hasTarget ? "border-accent/40" : "border-dashed border-border",
          // No target: fixed bottom-right, deliberately not bottom-center so
          // it never sits on top of the toast's horizontally-centered strip
          // either way. 136px clears both the mobile BottomBar (60px +
          // safe-area) and the taller of the two mobile exclusion zones, the
          // toast (TOAST_CLEARANCE, ~116px) — plus its own safe-area addend
          // for notched devices. md: has no BottomBar, so only needs to clear
          // the desktop toast (bottom-6 + its own height).
          !rect &&
            "bottom-[calc(136px+env(safe-area-inset-bottom))] right-3 md:bottom-20 md:right-3",
          "animate-tutorial-in motion-reduce:animate-none"
        )}
        style={{ width: CALLOUT_WIDTH, ...calloutStyle }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {progressLabel && (
              <span className="text-[10px] font-mono text-muted flex-shrink-0">{progressLabel}</span>
            )}
            <h3 className="text-sm font-semibold text-ink truncate">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close tutorial"
            className="flex-shrink-0 text-muted hover:text-ink hover:bg-surface-elevated transition-colors p-1.5 -m-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X size={13} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <p
          className={cn("text-xs text-muted leading-relaxed", hasTarget ? "mb-3" : "mb-1.5")}
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          {body}
        </p>
        {!hasTarget && (
          <p className="text-[11px] text-muted italic mb-3">
            Waiting for the right moment — it will point itself out once you get there.
          </p>
        )}
        <div className="flex items-center gap-2">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="flex-1 bg-primary hover:bg-primary-hover text-bg text-xs font-semibold py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[36px]"
            >
              {primaryAction.label}
            </button>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-muted hover:text-ink transition-colors px-2.5 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px]"
            >
              Back
            </button>
          )}
          {/*
            No separate "Skip tutorial" fallback here — the header's × already
            covers "abandon entirely" in every case this button would have
            appeared (primaryAction and onSkipStep are mutually exclusive by
            construction, so whenever this renders, it's alone in the row).
            Two controls that both closed the whole tutorial, under different
            labels, was the redundancy — not the existence of a close control.
          */}
          {onSkipStep && (
            <button
              onClick={onSkipStep}
              className="ml-auto text-xs text-muted hover:text-ink transition-colors px-2.5 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px]"
            >
              Skip this
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
