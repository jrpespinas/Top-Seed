import type {
  CheckIn,
  Court,
  CourtStatus,
  Match,
  MatchStatus,
  QueueLane,
  QueuedMatch,
  QueuedMatchStatus,
  QueueStatus,
  SessionStatus,
} from "../types/index.js";
import { err, ok, type DomainResult } from "../types/index.js";

export function checkInInitialStatus(): QueueStatus {
  return "waiting";
}

export function queuedMatchStatusForParticipantCount(count: number): QueuedMatchStatus {
  return count >= 4 ? "ready" : "draft";
}

export function canAddPlayerToQueuedMatch(queueStatus: QueueStatus): boolean {
  return queueStatus === "waiting" || queueStatus === "resting";
}

export function validateMarkDoneOrRemoved(queueStatus: QueueStatus): DomainResult<QueueStatus> {
  if (queueStatus === "playing") {
    return err("PLAYER_IS_PLAYING", "Finish or cancel the match first.");
  }
  return ok(queueStatus);
}

export function resolvePostMatchQueueStatus(
  checkInId: string,
  queuedMatches: QueuedMatch[],
): QueueStatus {
  const stillStaged = queuedMatches.some(
    (qm) =>
      (qm.status === "draft" || qm.status === "ready") &&
      qm.participants.some((p) => p.checkInId === checkInId),
  );
  return stillStaged ? "assigned" : "waiting";
}

export function validatePromoteQueuedMatch(
  queuedMatch: QueuedMatch,
  court: Court,
): DomainResult<QueuedMatchStatus> {
  if (queuedMatch.status !== "ready") {
    return err(
      "QUEUED_MATCH_NOT_READY",
      queuedMatch.participants.length < 4
        ? "Match needs four players."
        : "Add all players before sending to court.",
    );
  }

  if (queuedMatch.participants.length < 4) {
    return err("QUEUED_MATCH_INCOMPLETE", "Match needs four players.");
  }

  if (court.status === "paused" || court.status === "unavailable") {
    return err("COURT_NOT_OPEN", "Court is not available.");
  }

  if (court.status === "occupied" || court.currentMatchId !== null) {
    return err("COURT_ALREADY_OCCUPIED", "Court already has an active match.");
  }

  return ok("promoted");
}

export function validateCourtAssignment(court: Court): DomainResult<CourtStatus> {
  if (court.status === "paused" || court.status === "unavailable") {
    return err("COURT_NOT_OPEN", "Court is not available.");
  }
  if (court.status === "occupied" || court.currentMatchId !== null) {
    return err("COURT_ALREADY_OCCUPIED", "Court already has an active match.");
  }
  return ok("occupied");
}

export function validateStartMatch(match: Match): DomainResult<MatchStatus> {
  if (match.status !== "assigned") {
    return err("VALIDATION_ERROR", "Match must be assigned before starting.");
  }
  if (match.participants.length < 4) {
    return err("QUEUED_MATCH_INCOMPLETE", "Match needs four players.");
  }
  return ok("in_progress");
}

export function validateCompleteMatch(match: Match): DomainResult<MatchStatus> {
  if (match.status !== "in_progress") {
    return err("MATCH_NOT_IN_PROGRESS", "Start the match before recording a result.");
  }
  return ok("completed");
}

export function validateCorrectMatchResult(match: Match): DomainResult<MatchStatus> {
  if (match.status !== "completed") {
    return err("MATCH_NOT_COMPLETED", "Record the match result first.");
  }
  return ok(match.status);
}

export function courtStatusAfterMatchEnd(): CourtStatus {
  return "open";
}

export function validateSessionComplete(
  sessionStatus: SessionStatus,
  matches: Match[],
): DomainResult<SessionStatus> {
  if (sessionStatus !== "active") {
    return err("SESSION_NOT_ACTIVE", "This session is no longer live.");
  }

  const blocking = matches.some(
    (m) => m.status === "assigned" || m.status === "in_progress",
  );
  if (blocking) {
    return err("VALIDATION_ERROR", "Complete or cancel active court matches first.");
  }

  return ok("completed");
}

export function applySessionCompleteToCheckIns(checkIns: CheckIn[]): CheckIn[] {
  return checkIns.map((checkIn) => {
    if (checkIn.queueStatus === "waiting" || checkIn.queueStatus === "resting") {
      return { ...checkIn, queueStatus: "done" as const };
    }
    return checkIn;
  });
}

export function clearPlayerFromOtherQueuedMatches(
  promotedMatchId: string,
  playerCheckInIds: string[],
  queuedMatches: QueuedMatch[],
): QueuedMatch[] {
  return queuedMatches.map((queuedMatch) => {
    if (queuedMatch.id === promotedMatchId || queuedMatch.status === "promoted") {
      return queuedMatch;
    }
    if (queuedMatch.status !== "draft" && queuedMatch.status !== "ready") {
      return queuedMatch;
    }

    const filtered = queuedMatch.participants.filter(
      (p) => !playerCheckInIds.includes(p.checkInId),
    );

    if (filtered.length === queuedMatch.participants.length) {
      return queuedMatch;
    }

    return {
      ...queuedMatch,
      participants: filtered,
      status: queuedMatchStatusForParticipantCount(filtered.length),
    };
  });
}

export function validateDeleteQueueLane(
  lanes: QueueLane[],
  laneId: string,
): DomainResult<void> {
  const activeLanes = lanes.filter((lane) => lane.isActive);
  if (activeLanes.length <= 1 && activeLanes.some((lane) => lane.id === laneId)) {
    return err("QUEUE_LANE_REQUIRED", "At least one queue lane is required.");
  }
  return ok(undefined);
}

export function removeQueuedMatchesInLane(
  queuedMatches: QueuedMatch[],
  laneId: string,
): QueuedMatch[] {
  return queuedMatches.map((qm) => {
    if (qm.laneId !== laneId || qm.status === "promoted") {
      return qm;
    }
    if (qm.status === "draft" || qm.status === "ready") {
      return { ...qm, status: "removed" as const, participants: [] };
    }
    return qm;
  });
}

export function playerIdsOnActiveCourts(matches: Match[]): Set<string> {
  const ids = new Set<string>();
  for (const match of matches) {
    if (match.status === "assigned" || match.status === "in_progress") {
      for (const participant of match.participants) {
        ids.add(participant.checkInId);
      }
    }
  }
  return ids;
}

export function cancelMatchParticipantStatus(): QueueStatus {
  return "waiting";
}
