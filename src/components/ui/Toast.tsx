"use client";

import { useCallback, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastState {
  id: number;
  message: string;
  onUndo?: () => void;
  // aria-label for the Undo button — defaults to a plain "Undo" if omitted,
  // but callers should pass something specific ("Undo court assignment")
  // since the visible button text is always just "Undo".
  undoLabel?: string;
}

/**
 * The one toast implementation every reversible action in the app shares —
 * previously duplicated independently in the Dashboard, Matches, and Players
 * views. 5000ms + assertive alert when undoable, 2500ms + polite status
 * otherwise; see DESIGN.md's "Toast / Undo Notification" for the full spec.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, onUndo?: () => void, undoLabel?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = Date.now();
    setToast({ id, message, onUndo, undoLabel });
    timerRef.current = setTimeout(
      () => setToast((prev) => (prev?.id === id ? null : prev)),
      onUndo ? 5000 : 2500
    );
  }, []);

  const dismissAndUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast((prev) => {
      prev?.onUndo?.();
      return null;
    });
  }, []);

  return { toast, showToast, dismissAndUndo };
}

export function ToastViewport({
  toast,
  onDismissAndUndo,
}: {
  toast: ToastState | null;
  onDismissAndUndo: () => void;
}) {
  if (!toast) return null;

  return (
    <div
      key={toast.id}
      role={toast.onUndo ? "alert" : "status"}
      aria-live={toast.onUndo ? "assertive" : "polite"}
      className={cn(
        "fixed bottom-[76px] md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-elevated border border-border text-ink text-xs font-medium px-4 py-2.5 rounded-full shadow-lg z-[var(--z-toast)] animate-toast whitespace-nowrap",
        toast.onUndo ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      <Check size={12} strokeWidth={2.5} className="text-success flex-shrink-0" aria-hidden />
      {toast.message}
      {toast.onUndo && (
        <>
          <span className="w-px h-3 bg-border mx-0.5 flex-shrink-0" aria-hidden />
          <button
            onClick={onDismissAndUndo}
            className="text-primary hover:text-primary-hover font-semibold transition-colors rounded-sm px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label={toast.undoLabel ?? "Undo"}
          >
            Undo
          </button>
        </>
      )}
    </div>
  );
}
