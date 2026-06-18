import { getSessionMode } from "../lib/session-mode.js";
import type { SessionMode } from "../components/domain/types.js";

export function useSessionMode(status: string | undefined): SessionMode {
  if (!status) {
    return "live";
  }
  return getSessionMode(status);
}
