import type {
  LocalCheckIn,
  LocalCourt,
  LocalMatch,
  LocalPlayerProfile,
  LocalQueueLane,
  LocalQueuedMatch,
  OutboxAction,
} from "../db/types.js";

export interface SyncActionLabelContext {
  checkIns: Map<string, LocalCheckIn>;
  courts: Map<string, LocalCourt>;
  queueLanes: Map<string, LocalQueueLane>;
  queuedMatches: Map<string, LocalQueuedMatch>;
  matches: Map<string, LocalMatch>;
  playerProfiles: Map<string, LocalPlayerProfile>;
}

export interface SyncActionDescription {
  label: string;
  context?: string;
}

function checkInName(ctx: SyncActionLabelContext, checkInId: string): string | undefined {
  return ctx.checkIns.get(checkInId)?.playerDisplayName;
}

function courtName(ctx: SyncActionLabelContext, courtId: string): string | undefined {
  return ctx.courts.get(courtId)?.name;
}

function laneName(ctx: SyncActionLabelContext, laneId: string): string | undefined {
  return ctx.queueLanes.get(laneId)?.name;
}

export function describeSyncAction(
  action: OutboxAction,
  ctx: SyncActionLabelContext,
): SyncActionDescription {
  const payload = action.payload;

  switch (action.type) {
    case "CHECK_IN_PLAYER": {
      const name =
        checkInName(ctx, action.entityId) ??
        ctx.playerProfiles.get(String(payload.playerProfileId ?? ""))?.displayName;
      return { label: name ? `Check in ${name}` : "Check in player", context: name };
    }
    case "UPDATE_CHECK_IN": {
      const name = checkInName(ctx, action.entityId);
      if (payload.paymentStatus) {
        return { label: name ? `Update payment for ${name}` : "Update payment", context: name };
      }
      return { label: name ? `Update ${name}'s session status` : "Update check-in", context: name };
    }
    case "UPDATE_PAYMENT": {
      const name = checkInName(ctx, action.entityId);
      return { label: name ? `Mark ${name} paid` : "Update payment", context: name };
    }
    case "CREATE_QUEUED_MATCH": {
      const laneId = String(payload.queueLaneId ?? "");
      const lane = laneName(ctx, laneId);
      return { label: lane ? `Add match to ${lane}` : "Add queued match", context: lane };
    }
    case "REMOVE_QUEUED_MATCH": {
      const queuedMatch = ctx.queuedMatches.get(action.entityId);
      const lane = queuedMatch ? laneName(ctx, queuedMatch.queueLaneId) : undefined;
      return { label: lane ? `Remove match from ${lane}` : "Remove queued match", context: lane };
    }
    case "MOVE_QUEUED_MATCH_TO_COURT": {
      const courtId = String(payload.courtId ?? "");
      const court = courtName(ctx, courtId);
      return { label: court ? `Send match to ${court}` : "Send match to court", context: court };
    }
    case "START_MATCH": {
      const match = ctx.matches.get(action.entityId);
      const court = match?.courtId ? courtName(ctx, match.courtId) : undefined;
      return { label: court ? `Start match on ${court}` : "Start match", context: court };
    }
    case "COMPLETE_MATCH": {
      const match = ctx.matches.get(action.entityId);
      const court = match?.courtId ? courtName(ctx, match.courtId) : undefined;
      return { label: court ? `Record ${court} result` : "Record match result", context: court };
    }
    case "UPDATE_MATCH_RESULT": {
      const match = ctx.matches.get(action.entityId);
      const court = match?.courtId ? courtName(ctx, match.courtId) : undefined;
      return { label: court ? `Correct ${court} result` : "Correct match result", context: court };
    }
    case "UPDATE_PLAYER_PROFILE": {
      const name = ctx.playerProfiles.get(action.entityId)?.displayName;
      return { label: name ? `Update ${name}'s profile` : "Update player profile", context: name };
    }
    case "CREATE_PLAYER_PROFILE":
    case "CREATE_PLAYER": {
      const name =
        String(payload.displayName ?? "") ||
        ctx.playerProfiles.get(action.entityId)?.displayName;
      return { label: name ? `Add player ${name}` : "Add player", context: name };
    }
    case "CREATE_QUEUE_LANE": {
      const name = String(payload.name ?? "") || laneName(ctx, action.entityId);
      return { label: name ? `Add queue lane ${name}` : "Add queue lane", context: name };
    }
    case "UPDATE_QUEUE_LANE": {
      const name = String(payload.name ?? "") || laneName(ctx, action.entityId);
      return { label: name ? `Rename ${name}` : "Update queue lane", context: name };
    }
    case "DELETE_QUEUE_LANE": {
      const name = laneName(ctx, action.entityId);
      return { label: name ? `Delete ${name}` : "Delete queue lane", context: name };
    }
    case "REORDER_QUEUE_LANES":
      return { label: "Reorder queue lanes" };
    case "CREATE_COURT": {
      const name = String(payload.name ?? "") || courtName(ctx, action.entityId);
      return { label: name ? `Add ${name}` : "Add court", context: name };
    }
    case "DELETE_COURT": {
      const name = courtName(ctx, action.entityId);
      return { label: name ? `Delete ${name}` : "Delete court", context: name };
    }
    case "UPDATE_COURT": {
      const name = String(payload.name ?? "") || courtName(ctx, action.entityId);
      return { label: name ? `Rename ${name}` : "Update court", context: name };
    }
    case "CREATE_SESSION":
      return { label: "Create session" };
    case "START_SESSION":
      return { label: "Start session" };
    case "COMPLETE_SESSION":
      return { label: "Complete session" };
    default:
      return { label: "Sync change" };
  }
}

export function formatSyncErrorMessage(action: OutboxAction): string {
  if (action.status === "blocked") {
    return "Waiting on an earlier change before this can sync.";
  }
  if (action.errorMessage) {
    return action.errorMessage;
  }
  if (action.status === "pending") {
    return "Waiting to sync.";
  }
  return "Could not sync this change.";
}
