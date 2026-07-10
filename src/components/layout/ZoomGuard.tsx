"use client";

import { useEffect } from "react";

const ZOOMABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * 16px+ on every form field (see the input/textarea/select classNames
 * throughout the app) already stops iOS Safari's auto-zoom-on-focus at the
 * source — this is a safety net for whatever that doesn't catch (manual
 * pinch/double-tap zoom mid-interaction, a future field someone adds without
 * the 16px floor). While a form field is focused, it temporarily caps the
 * viewport at its current scale so it can't zoom further, then hands the
 * page back to normal pinch-zoom (accessibility requires this stay
 * available generally — permanently locking maximum-scale is a WCAG 1.4.4
 * failure) the moment focus leaves the field, snapping back to scale 1 if
 * anything had zoomed during the interaction.
 */
export function ZoomGuard() {
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    const original = viewport.getAttribute("content") ?? "";

    const isZoomable = (target: EventTarget | null) =>
      target instanceof HTMLElement && ZOOMABLE_TAGS.has(target.tagName);

    const onFocusIn = (e: FocusEvent) => {
      if (!isZoomable(e.target)) return;
      viewport.setAttribute("content", `${original}, maximum-scale=1`);
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!isZoomable(e.target)) return;
      // Reasserting the unmodified content forces Safari to re-evaluate and
      // snap back to scale 1 before restoring normal pinch-zoom capability.
      viewport.setAttribute("content", `${original}, maximum-scale=1`);
      requestAnimationFrame(() => viewport.setAttribute("content", original));
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}
