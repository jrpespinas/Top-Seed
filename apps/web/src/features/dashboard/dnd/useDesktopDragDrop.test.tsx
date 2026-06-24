/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDesktopDragDrop } from "./useDesktopDragDrop.js";
import {
  FINE_POINTER_MEDIA,
  LG_MEDIA,
  REDUCED_MOTION_MEDIA,
} from "./desktop-drag-drop-gating.js";

function mockMatchMedia(matches: Record<string, boolean>) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches[query] ?? false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("useDesktopDragDrop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns enabled on desktop fine pointer live session", async () => {
    mockMatchMedia({
      [LG_MEDIA]: true,
      [FINE_POINTER_MEDIA]: true,
      [REDUCED_MOTION_MEDIA]: false,
    });
    const { result } = renderHook(() => useDesktopDragDrop("live"));
    await waitFor(() => {
      expect(result.current.enabled).toBe(true);
    });
  });

  it("returns disabled on narrow viewport", async () => {
    mockMatchMedia({
      [LG_MEDIA]: false,
      [FINE_POINTER_MEDIA]: true,
      [REDUCED_MOTION_MEDIA]: false,
    });
    const { result } = renderHook(() => useDesktopDragDrop("live"));
    await waitFor(() => {
      expect(result.current.enabled).toBe(false);
    });
  });
});
