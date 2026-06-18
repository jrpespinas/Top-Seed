import type { SyncAction, SyncActionResult, SyncActionsRequest } from "@top-seed/contracts";
import {
  checkInPlayerPayloadSchema,
  completeMatchPayloadSchema,
  createPlayerProfilePayloadSchema,
  createCourtPayloadSchema,
  createQueueLanePayloadSchema,
  createQueuedMatchPayloadSchema,
  deleteQueueLanePayloadSchema,
  deleteCourtPayloadSchema,
  updateCourtPayloadSchema,
  moveQueuedMatchToCourtPayloadSchema,
  reorderQueueLanesPayloadSchema,
  removeQueuedMatchPayloadSchema,
  startMatchPayloadSchema,
  updateCheckInPayloadSchema,
  updateMatchResultPayloadSchema,
  updatePaymentPayloadSchema,
  updatePlayerProfilePayloadSchema,
  updateQueueLanePayloadSchema,
} from "@top-seed/contracts";
import { checkInPlayer } from "../check-ins/check-in-player.js";
import { updateCheckIn } from "../check-ins/update-check-in.js";
import { updateMatchResult } from "../matches/correct-match-result.js";
import { completeMatch, startMatch } from "../matches/match-lifecycle.js";
import { updatePayment } from "../payments/update-payment.js";
import { createPlayerProfile } from "../players/create-player-profile.js";
import { updatePlayerProfile } from "../players/update-player-profile.js";
import { createCourt, deleteCourt, updateCourt } from "../courts/court.js";
import { createQueuedMatch, promoteQueuedMatchToCourt, removeQueuedMatch } from "../queue/queued-match.js";
import {
  createQueueLane,
  deleteQueueLane,
  reorderQueueLanes,
  updateQueueLane,
} from "../queue/queue-lane.js";
import {
  findSyncActionLog,
  recordSyncActionLog,
  toAlreadyAppliedResult,
} from "../../shared/infrastructure/prisma/idempotency.js";
import { UseCaseError } from "../../shared/application/errors.js";

async function dispatchAction(action: SyncAction): Promise<SyncActionResult> {
  switch (action.type) {
    case "CREATE_PLAYER_PROFILE":
    case "CREATE_PLAYER": {
      const payload = createPlayerProfilePayloadSchema.parse(action.payload);
      const { profile } = await createPlayerProfile({
        id: action.entityId,
        organizationId: payload.organizationId,
        displayName: payload.displayName,
        phone: payload.phone,
        defaultSkillRating: payload.defaultSkillRating,
        notes: payload.notes,
        isActive: payload.isActive,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: profile.id,
        serverUpdatedAt: profile.updatedAt,
      };
    }
    case "UPDATE_PLAYER_PROFILE": {
      const payload = updatePlayerProfilePayloadSchema.parse(action.payload);
      const { profile } = await updatePlayerProfile({
        playerProfileId: action.entityId,
        payload,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: profile.id,
        serverUpdatedAt: profile.updatedAt,
      };
    }
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
        serverUpdatedAt: checkIn.updatedAt,
      };
    }
    case "UPDATE_CHECK_IN": {
      const payload = updateCheckInPayloadSchema.parse(action.payload);
      const { checkIn, serverVersion } = await updateCheckIn({
        checkInId: action.entityId,
        sessionId: action.sessionId!,
        payload,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: checkIn.id,
        serverVersion,
        serverUpdatedAt: checkIn.updatedAt,
      };
    }
    case "UPDATE_PAYMENT": {
      const payload = updatePaymentPayloadSchema.parse(action.payload);
      const { checkIn, serverVersion } = await updatePayment({
        checkInId: action.entityId,
        sessionId: action.sessionId!,
        payload,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: checkIn.id,
        serverVersion,
        serverUpdatedAt: checkIn.updatedAt,
      };
    }
    case "CREATE_COURT": {
      const payload = createCourtPayloadSchema.parse(action.payload);
      const { court, serverVersion, serverUpdatedAt } = await createCourt({
        id: action.entityId,
        sessionId: payload.sessionId,
        name: payload.name,
        sortOrder: payload.sortOrder,
        status: payload.status,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: court.id,
        serverVersion,
        serverUpdatedAt,
      };
    }
    case "DELETE_COURT": {
      deleteCourtPayloadSchema.parse(action.payload);
      const { serverVersion, serverUpdatedAt } = await deleteCourt({
        courtId: action.entityId,
        sessionId: action.sessionId!,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: action.entityId,
        serverVersion,
        serverUpdatedAt,
      };
    }
    case "UPDATE_COURT": {
      const payload = updateCourtPayloadSchema.parse(action.payload);
      const { court, serverVersion, serverUpdatedAt } = await updateCourt({
        courtId: action.entityId,
        sessionId: action.sessionId!,
        name: payload.name,
        sortOrder: payload.sortOrder,
        status: payload.status,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: court.id,
        serverVersion,
        serverUpdatedAt,
      };
    }
    case "CREATE_QUEUE_LANE": {
      const payload = createQueueLanePayloadSchema.parse(action.payload);
      const { lane, serverVersion, serverUpdatedAt } = await createQueueLane({
        id: action.entityId,
        sessionId: payload.sessionId,
        name: payload.name,
        sortOrder: payload.sortOrder,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: lane.id,
        serverVersion,
        serverUpdatedAt,
      };
    }
    case "UPDATE_QUEUE_LANE": {
      const payload = updateQueueLanePayloadSchema.parse(action.payload);
      const { lane, serverVersion, serverUpdatedAt } = await updateQueueLane({
        laneId: action.entityId,
        sessionId: action.sessionId!,
        name: payload.name,
        sortOrder: payload.sortOrder,
        status: payload.status,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: lane.id,
        serverVersion,
        serverUpdatedAt,
      };
    }
    case "DELETE_QUEUE_LANE": {
      const payload = deleteQueueLanePayloadSchema.parse(action.payload);
      const result = await deleteQueueLane({
        laneId: action.entityId,
        sessionId: action.sessionId!,
        deleteQueuedMatches: payload.deleteQueuedMatches,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: result.lane?.id ?? action.entityId,
        serverVersion: result.serverVersion,
        serverUpdatedAt: result.serverUpdatedAt,
      };
    }
    case "REORDER_QUEUE_LANES": {
      const payload = reorderQueueLanesPayloadSchema.parse(action.payload);
      const { serverVersion, serverUpdatedAt } = await reorderQueueLanes({
        sessionId: action.sessionId!,
        orderedLaneIds: payload.orderedLaneIds,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: action.entityId,
        serverVersion,
        serverUpdatedAt,
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
    case "REMOVE_QUEUED_MATCH": {
      removeQueuedMatchPayloadSchema.parse(action.payload);
      const { serverVersion, serverUpdatedAt } = await removeQueuedMatch({
        queuedMatchId: action.entityId,
        sessionId: action.sessionId!,
      });
      return {
        actionId: action.id,
        status: "applied",
        entityType: action.entityType,
        entityId: action.entityId,
        canonicalEntityId: action.entityId,
        serverVersion,
        serverUpdatedAt,
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
    case "UPDATE_MATCH_RESULT": {
      const payload = updateMatchResultPayloadSchema.parse(action.payload);
      const { serverVersion, sideEffects } = await updateMatchResult({
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
