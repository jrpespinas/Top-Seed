import { describe, expect, it } from "vitest";
import { computeDesktopDragDropEnabled } from "./desktop-drag-drop-gating.js";

describe("computeDesktopDragDropEnabled", () => {
  it("enables on large viewport with fine pointer and live session", () => {
    expect(
      computeDesktopDragDropEnabled({
        isLargeViewport: true,
        hasFinePointer: true,
        prefersReducedMotion: false,
        sessionMode: "live",
      }),
    ).toBe(true);
  });

  it("disables on narrow viewport", () => {
    expect(
      computeDesktopDragDropEnabled({
        isLargeViewport: false,
        hasFinePointer: true,
        prefersReducedMotion: false,
        sessionMode: "live",
      }),
    ).toBe(false);
  });

  it("disables without fine pointer", () => {
    expect(
      computeDesktopDragDropEnabled({
        isLargeViewport: true,
        hasFinePointer: false,
        prefersReducedMotion: false,
        sessionMode: "live",
      }),
    ).toBe(false);
  });

  it("disables when prefers reduced motion", () => {
    expect(
      computeDesktopDragDropEnabled({
        isLargeViewport: true,
        hasFinePointer: true,
        prefersReducedMotion: true,
        sessionMode: "live",
      }),
    ).toBe(false);
  });

  it("disables for ended session", () => {
    expect(
      computeDesktopDragDropEnabled({
        isLargeViewport: true,
        hasFinePointer: true,
        prefersReducedMotion: false,
        sessionMode: "ended",
      }),
    ).toBe(false);
  });
});
