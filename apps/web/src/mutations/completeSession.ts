import { completeSessionPayloadSchema } from "@top-seed/contracts";
import { db } from "../db/database.js";
import type { LocalSession } from "../db/types.js";
import { DEFAULT_ORG_ID } from "../lib/device.js";
import { isLiveSession } from "../lib/session-mode.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export async function completeSessionLocal(
  sessionId: string,
  options?: { syncActionId?: string; completedAt?: string },
): Promise<LocalSession> {
  const completedAt = options?.completedAt ?? new Date().toISOString();
  const actionId = options?.syncActionId ?? crypto.randomUUID();

  return applyMutation({
    run: async () => {
      return runInTransaction(async () => {
        const session = await db.sessions.get(sessionId);
        if (!session) {
          throw new Error("Session not found in local store.");
        }
        if (!isLiveSession(session.status)) {
          throw new Error("Only live sessions can be completed.");
        }

        const updated: LocalSession = {
          ...session,
          status: "completed",
        };

        await db.sessions.put(updated);
        await enqueueSyncAction({
          id: actionId,
          organizationId: session.organizationId ?? DEFAULT_ORG_ID,
          type: "COMPLETE_SESSION",
          entityType: "session",
          entityId: sessionId,
          sessionId,
          payload: completeSessionPayloadSchema.parse({ completedAt }),
          createdAt: completedAt,
        });

        return updated;
      });
    },
  });
}
