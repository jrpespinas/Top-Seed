import { useEffect, useRef } from "react";

/**
 * Keyboard focus for the two-step inline confirm pattern (Close, Discard,
 * Reset, Clear — any destructive action that cross-fades its trigger button
 * into a Confirm/Cancel row). The swap unmounts whichever button was just
 * focused, dropping focus to <body> unless moved explicitly.
 *
 * Covers the "single fixed trigger button" shape only. A confirm flow whose
 * return target depends on other state (MatchesView's Void/Restore, which
 * refocuses a different button depending on match.status) is a genuine
 * variant, not this same pattern — it keeps its own bespoke ref handling
 * rather than being forced through this hook's fixed-trigger shape.
 *
 * `swapped` defaults to `isConfirming`; pass it explicitly when a third
 * transient state (e.g. a "Done" confirmation) also counts as "away from
 * idle" and should return focus to the trigger once it clears too.
 */
export function useConfirmFocus<T extends HTMLElement = HTMLButtonElement>(
  isConfirming: boolean,
  swapped: boolean = isConfirming
) {
  const triggerRef = useRef<T>(null);
  const cancelRef = useRef<T>(null);
  const wasConfirming = useRef(isConfirming);
  const wasSwapped = useRef(swapped);

  useEffect(() => {
    if (isConfirming && !wasConfirming.current) {
      cancelRef.current?.focus();
    } else if (!swapped && wasSwapped.current) {
      triggerRef.current?.focus();
    }
    wasConfirming.current = isConfirming;
    wasSwapped.current = swapped;
  }, [isConfirming, swapped]);

  return { triggerRef, cancelRef };
}
