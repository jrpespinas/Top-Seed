import { useSyncExternalStore } from "react";

// Every ElapsedTimer instance used to run its own setInterval, so a full
// queue (one timer per waiting player) plus active courts meant many
// independent 1s callbacks and React commits per second. This centralizes
// them into one interval and one batched notify, while each subscriber still
// only re-renders itself.
let now = Date.now();
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (intervalId === null) {
    intervalId = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return now;
}

export function useTick() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
