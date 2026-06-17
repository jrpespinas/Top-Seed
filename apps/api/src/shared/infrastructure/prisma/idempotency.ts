import type { Prisma } from "@prisma/client";
import type { SyncActionResult } from "@top-seed/contracts";
import { prisma } from "./client.js";

export async function findSyncActionLog(
  organizationId: string,
  deviceId: string,
  actionId: string,
) {
  return prisma.syncActionLog.findUnique({
    where: {
      organizationId_deviceId_actionId: { organizationId, deviceId, actionId },
    },
  });
}

export async function recordSyncActionLog(input: {
  organizationId: string;
  deviceId: string;
  actionId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  status: string;
  resultJson?: Prisma.InputJsonValue;
}) {
  return prisma.syncActionLog.create({ data: input });
}

export function toAlreadyAppliedResult(
  log: {
    actionId: string;
    entityType: string;
    entityId: string;
    resultJson: Prisma.JsonValue;
  },
): SyncActionResult {
  const stored = (log.resultJson ?? {}) as SyncActionResult;
  return {
    actionId: log.actionId,
    status: "already_applied",
    entityType: log.entityType,
    entityId: log.entityId,
    canonicalEntityId: stored.canonicalEntityId ?? log.entityId,
    serverVersion: stored.serverVersion,
    serverUpdatedAt: stored.serverUpdatedAt,
    createdEntities: stored.createdEntities,
    sideEffects: stored.sideEffects,
  };
}
