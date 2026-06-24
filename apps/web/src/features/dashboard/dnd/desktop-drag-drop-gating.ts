import type { SessionMode } from "../../../components/domain/types.js";

const LG_MEDIA = "(min-width: 1024px)";
const FINE_POINTER_MEDIA = "(pointer: fine)";
const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

export interface DesktopDragDropState {
  enabled: boolean;
}

export function computeDesktopDragDropEnabled(input: {
  isLargeViewport: boolean;
  hasFinePointer: boolean;
  prefersReducedMotion: boolean;
  sessionMode: SessionMode;
}): boolean {
  if (input.sessionMode === "ended") {
    return false;
  }
  if (!input.isLargeViewport || !input.hasFinePointer) {
    return false;
  }
  if (input.prefersReducedMotion) {
    return false;
  }
  return true;
}

function readMatchMedia(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

export function readDesktopDragDropSignals(sessionMode: SessionMode) {
  return {
    isLargeViewport: readMatchMedia(LG_MEDIA),
    hasFinePointer: readMatchMedia(FINE_POINTER_MEDIA),
    prefersReducedMotion: readMatchMedia(REDUCED_MOTION_MEDIA),
    sessionMode,
  };
}

export { LG_MEDIA, FINE_POINTER_MEDIA, REDUCED_MOTION_MEDIA };
