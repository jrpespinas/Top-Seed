import type { OutboxAction } from "../db/types.js";
import { createSessionOnServer, startSessionOnServer } from "../lib/session-api.js";
import { createSessionPayloadSchema, startSessionPayloadSchema } from "@top-seed/contracts";
import { DEFAULT_ORG_ID } from "../lib/device.js";

export async function syncSessionActionViaRest(action: OutboxAction): Promise<void> {
  if (action.type === "CREATE_SESSION") {
    const payload = createSessionPayloadSchema.parse(action.payload);
    const courtCount = await countCourtsForSession(action.entityId);
    await createSessionOnServer({
      id: action.entityId,
      organizationId: action.organizationId || DEFAULT_ORG_ID,
      name: payload.name,
      venueName: payload.venueName,
      startsAt: payload.startsAt,
      feeAmount: payload.feeAmount,
      currency: payload.currency,
      queueMode: payload.queueMode,
      ratingMode: payload.ratingMode,
      courtCount,
    });
    return;
  }

  if (action.type === "START_SESSION") {
    startSessionPayloadSchema.parse(action.payload);
    await startSessionOnServer(action.entityId);
    return;
  }

  if (action.type === "COMPLETE_SESSION") {
    // Server complete endpoint not wired in Phase 2 — local status is source of truth.
    return;
  }
}

async function countCourtsForSession(sessionId: string): Promise<number> {
  const { db } = await import("../db/database.js");
  return db.courts.where("sessionId").equals(sessionId).count();
}

export function isSessionSyncAction(type: string): boolean {
  return type === "CREATE_SESSION" || type === "START_SESSION" || type === "COMPLETE_SESSION";
}
