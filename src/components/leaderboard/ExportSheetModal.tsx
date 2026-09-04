"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ImageDown, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShareSheet, SHEET_WIDTH_PX, type ShareSheetData } from "./ShareSheet";

/** Capture at 2x so the PNG stays sharp when a chat client scales it up. */
const CAPTURE_SCALE = 2;

/** Breathing room around the preview, subtracted before computing the scale. */
const FRAME_PADDING_PX = 16;

function fileStem(data: ShareSheetData): string {
  const date = new Date(data.sessionDate).toISOString().slice(0, 10);
  const name = data.sessionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${name || "session"}-${date}`;
}

/**
 * Preview first, then choose an output.
 *
 * Deliberately not a format dropdown. The sheet has to be in the DOM to be
 * captured at all, so previewing it costs nothing — and it turns "PNG or PDF?"
 * from a decision made blind into a consequence of seeing the thing you're
 * about to post to thirty people.
 */
export function ExportSheetModal({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: ShareSheetData | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsCapturing(false);
    const id = setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  // The sheet is a fixed 794px so print and capture geometry agree; the preview
  // scales it down to whatever the viewport allows. Capture always reads the
  // unscaled node, so the transform here never reaches the output.
  useEffect(() => {
    if (!isOpen) return;
    const measure = () => {
      // clientWidth includes the frame's own padding, which the sheet can't use.
      const available = (frameRef.current?.clientWidth ?? SHEET_WIDTH_PX) - FRAME_PADDING_PX * 2;
      setScale(Math.min(1, Math.max(0.1, available / SHEET_WIDTH_PX)));
      setSheetHeight(sheetRef.current?.offsetHeight ?? 0);
    };
    measure();
    // A transform on the wrapper doesn't change the sheet's own box, so
    // observing it can't feed back into the scale it produces.
    const observer = new ResizeObserver(measure);
    if (sheetRef.current) observer.observe(sheetRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isOpen, data]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCapturing) onClose();
      if (e.key !== "Tab") return;
      const el = dialogRef.current;
      if (!el) return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isCapturing, onClose]);

  const handleDownloadImage = useCallback(async () => {
    const node = sheetRef.current;
    if (!node || !data || isCapturing) return;
    setIsCapturing(true);
    setError(null);
    try {
      // Dynamically imported so the capture library never loads for anyone who
      // doesn't export — the same pattern SessionDetailView uses for xlsx.
      const { toPng, getFontEmbedCSS } = await import("html-to-image");
      // Without this the capture renders in the fallback stack: cloned nodes
      // don't inherit the document's loaded @font-face rules, which is the
      // single most common way this feature ships silently broken.
      const fontEmbedCSS = await getFontEmbedCSS(node);
      const dataUrl = await toPng(node, {
        pixelRatio: CAPTURE_SCALE,
        // The sheet's own constant, never a measured width. Measuring reads
        // whatever the preview's layout happened to impose on this node.
        width: SHEET_WIDTH_PX,
        height: node.offsetHeight,
        backgroundColor: "#ffffff",
        fontEmbedCSS,
        // The preview's scale lives on an ancestor, but be explicit — a
        // transform reaching the clone would bake the preview zoom in.
        style: { transform: "none", transformOrigin: "top left" },
      });
      const link = document.createElement("a");
      link.download = `${fileStem(data)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Never fail to a blank download — say so and leave the modal open so
      // Print is still reachable as a way out.
      setError("Couldn't build the image. Try Print instead, or reload and retry.");
    } finally {
      setIsCapturing(false);
    }
  }, [data, isCapturing]);

  if (!mounted || !data) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 bg-bg/70 backdrop-blur-sm z-[var(--z-modal-backdrop)]",
          "transition-opacity duration-200 motion-reduce:transition-none",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={isCapturing ? undefined : onClose}
        aria-hidden
      />

      <div
        className={cn(
          "fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4",
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Export session sheet"
          aria-hidden={!isOpen}
          className={cn(
            "w-full max-w-3xl max-h-[90vh] bg-surface border border-border rounded-lg flex flex-col",
            "transition-all duration-200 ease-out motion-reduce:transition-none",
            isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-2 px-5 h-14 border-b border-border flex-shrink-0">
            <h2 className="text-base font-semibold text-ink flex-1 truncate">Session sheet</h2>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              disabled={isCapturing}
              className="text-muted hover:text-ink hover:bg-surface-elevated transition-colors p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border min-h-[36px] min-w-[36px] flex items-center justify-center disabled:opacity-40"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div
            ref={frameRef}
            className="flex-1 overflow-auto bg-surface-elevated/40"
            style={{ padding: FRAME_PADDING_PX }}
          >
            {/* Reserves the scaled sheet's footprint. Without it the transform
                would visually shrink the sheet while its ancestor still
                occupied the full 794px, leaving a large dead gap below. */}
            <div
              style={{
                width: SHEET_WIDTH_PX * scale,
                height: sheetHeight ? sheetHeight * scale : undefined,
                margin: "0 auto",
              }}
            >
              <div
                style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
                className="shadow-lg"
              >
                {/* Only mounted while open. Left in the DOM permanently it
                    would cost a full second render of the standings on every
                    Leaderboard update, and — because it carries
                    `data-print-root` — would hijack a stray Cmd+P on a page
                    where nobody asked to print a sheet. */}
                {/* Explicit width, because this wrapper sits inside the
                    scaled preview container and would otherwise inherit the
                    *scaled* width — the sheet would overflow it, and the
                    capture, which measures this node, would crop to the
                    preview's zoom level instead of the sheet's true size. */}
                <div ref={sheetRef} style={{ width: SHEET_WIDTH_PX }}>
                  {isOpen && <ShareSheet data={data} />}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-border flex-shrink-0">
            {error && (
              <p className="text-xs text-error mb-3" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadImage}
                disabled={isCapturing}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 bg-primary text-bg text-sm font-semibold py-2.5 rounded-md",
                  "transition-colors duration-150 min-h-[44px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  isCapturing ? "opacity-50 cursor-not-allowed" : "hover:bg-primary-hover"
                )}
              >
                <ImageDown size={15} strokeWidth={2} aria-hidden />
                {isCapturing ? "Building image…" : "Download image"}
              </button>
              <button
                onClick={() => window.print()}
                disabled={isCapturing}
                className="flex items-center justify-center gap-2 text-sm font-medium text-ink bg-surface-elevated hover:bg-surface-elevated/70 border border-border transition-colors px-4 py-2.5 rounded-md min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border disabled:opacity-40"
              >
                <Printer size={15} strokeWidth={2} aria-hidden />
                Print / Save as PDF
              </button>
            </div>
            <p className="text-[11px] text-muted mt-2.5">
              The image carries the top 10; the printed sheet carries everyone.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
