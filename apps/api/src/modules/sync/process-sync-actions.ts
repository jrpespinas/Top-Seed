import type { SyncAction, SyncActionResult, SyncActionsRequest } from "@top-seed/contracts";
import {
  checkInPlayerPayloadSchema,
  completeMatchPayloadSchema,
  createQueuedMatchPayloadSchema,
  moveQueuedMatchToCourtPayloadSchema,
  startMatchPayloadSchema,
} from "@top-seed/contracts";
import { checkInPlayer } from "../check-ins/check-in-player.js";
import { createQueuedMatch, promoteQueuedMatchToCourt } from "../queue/queued-match.js";
import { completeMatch, startMatch } from "../matches/match-lifecycle.js";
import {
  findSyncActionLog,
  recordSyncActionLog,
  toAlreadyAppliedResult,
} from "../../shared/infrastructure/prisma/idempotency.js";
import { UseCaseError } from "../../shared/application/errors.js";

async function dispatchAction(action: SyncAction): Promise<SyncActionResult> {
  switch (action.type) {
    case "CHECK_IN_PLAYER": {
      const payload = checkInPlayerPayloadSchema.parse(action.payload);
      const { checkIn, serverVersion } = await checkInPlayer({
        id: action.entityId,
        sessionId: payload.sessionId,
        playerProfileId: payload.playerProfileId,
        arrivalOrder: payload.arrivalOrder,
        checkedInAt: payload.checkedInAt,
        sessionSkillRating: payload.sessionSkillRating,
        paymentAmountDue: payload.paymentAmountDue,
        paymentAmountPaid: payload.paymentAmountPaid,
        paymentMethod: payload.paymentMethod,
        paymentNotes: payload.paymentNotes,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: checkIn.id,
        serverVersion,
        serverUpdatedAt: new Date().toISOString(),
      };
    }
    case "CREATE_QUEUED_MATCH": {
      const payload = createQueuedMatchPayloadSchema.parse(action.payload);
      const { serverVersion } = await createQueuedMatch({
        id: action.entityId,
        sessionId: payload.sessionId,
        queueLaneId: payload.queueLaneId,
        sortOrder: payload.sortOrder,
        createdFrom: payload.createdFrom,
        participants: payload.participants,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: action.entityId,
        serverVersion,
        serverUpdatedAt: new Date().toISOString(),
      };
    }
    case "MOVE_QUEUED_MATCH_TO_COURT": {
      const payload = moveQueuedMatchToCourtPayloadSchema.parse(action.payload);
      const { serverVersion } = await promoteQueuedMatchToCourt({
        queuedMatchId: action.entityId,
        sessionId: action.sessionId!,
        courtId: payload.courtId,
        matchId: payload.matchId,
        assignedAt: payload.assignedAt,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: action.entityId,
        createdEntities: [
          {
            entityType: "match",
            clientEntityId: payload.matchId,
            canonicalEntityId: payload.matchId,
          },
        ],
        serverVersion,
        serverUpdatedAt: new Date().toISOString(),
      };
    }
    case "START_MATCH": {
      const payload = startMatchPayloadSchema.parse(action.payload);
      const { serverVersion } = await startMatch({
        sessionId: action.sessionId!,
        matchId: action.entityId,
        startedAt: payload.startedAt,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: action.entityId,
        serverVersion,
        serverUpdatedAt: new Date().toISOString(),
      };
    }
    case "COMPLETE_MATCH": {
      const payload = completeMatchPayloadSchema.parse(action.payload);
      const { serverVersion, sideEffects } = await completeMatch({
        sessionId: action.sessionId!,
        matchId: action.entityId,
        result: payload,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: action.entityId,
        serverVersion,
        serverUpdatedAt: new Date().toISOString(),
        sideEffects,
      };
    }
    default:
      throw new UseCaseError("SYNC_ACTION_UNKNOWN", `Sync action not supported: ${action.type}`);
  }
}

export async function processSyncActions(request: SyncActionsRequest) {
  const results: SyncActionResult[] = [];
  let blocked = false;

  for (const action of request.actions) {
    if (blocked) {
      results.push({
        actionId: action.id,
        status: "blocked",
        entityType: action.entityType,
        entityId: action.entityId,
        errorCode: "SYNC_ACTION_BLOCKED",
        message: "Waiting on an earlier change.",
      });
      continue;
    }

    const existing = await findSyncActionLog(
      request.organizationId,
      request.deviceId,
      action.id,
    );
    if (existing) {
      results.push(toAlreadyAppliedResult(existing));
      continue;
    }

    try {
      const result = await dispatchAction(action);
      await recordSyncActionLog({
        organizationId: request.organizationId,
        deviceId: request.deviceId,
        actionId: action.id,
        actionType: action.type,
        entityType: action.entityType,
        entityId: action.entityId,
        status: result.status,
        resultJson: result,
      });
      results.push(result);
    } catch (error) {
      const useCaseError =
        error instanceof UseCaseError
          ? error
          : new UseCaseError("INTERNAL_ERROR", "Something went wrong. Try again.");
      blocked = true;
      results.push({
        actionId: action.id,
        status: "failed",
        entityType: action.entityType,
        entityId: action.entityId,
        errorCode: useCaseError.code,
        message: useCaseError.message,
      });
    }
  }

  return {
    organizationId: request.organizationId,
    deviceId: request.deviceId,
    processedAt: new Date().toISOString(),
    results,
  };
}
