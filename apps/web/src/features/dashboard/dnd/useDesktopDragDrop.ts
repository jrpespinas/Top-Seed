import { useEffect, useState } from "react";
import type { SessionMode } from "../../../components/domain/types.js";
import {
  computeDesktopDragDropEnabled,
  FINE_POINTER_MEDIA,
  LG_MEDIA,
  readDesktopDragDropSignals,
  REDUCED_MOTION_MEDIA,
} from "./desktop-drag-drop-gating.js";

export function useDesktopDragDrop(sessionMode: SessionMode): { enabled: boolean } {
  const [enabled, setEnabled] = useState(() =>
    computeDesktopDragDropEnabled(readDesktopDragDropSignals(sessionMode)),
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setEnabled(false);
      return;
    }

    const media = [LG_MEDIA, FINE_POINTER_MEDIA, REDUCED_MOTION_MEDIA].map((query) =>
      window.matchMedia(query),
    );

    const update = () => {
      setEnabled(computeDesktopDragDropEnabled(readDesktopDragDropSignals(sessionMode)));
    };

    update();
    for (const queryList of media) {
      queryList.addEventListener("change", update);
    }
    return () => {
      for (const queryList of media) {
        queryList.removeEventListener("change", update);
      }
    };
  }, [sessionMode]);

  return { enabled };
}
