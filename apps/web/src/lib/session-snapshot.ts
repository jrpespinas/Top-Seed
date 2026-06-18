import type { SessionSnapshot } from "@top-seed/domain";
import { db } from "../db/database.js";
import type {
  LocalCheckIn,
  LocalCourt,
  LocalMatch,
  LocalQueuedMatch,
  LocalQueueLane,
  LocalSession,
} from "../db/types.js";

function mapCheckIn(checkIn: LocalCheckIn) {
  return {
    id: checkIn.id,
    playerProfileId: checkIn.playerProfileId,
    queueStatus: checkIn.queueStatus as SessionSnapshot["checkIns"][0]["queueStatus"],
    sessionSkillRating: checkIn.sessionSkillRating,
    arrivalOrder: checkIn.arrivalOrder,
    checkedInAt: checkIn.checkedInAt,
    matchesPlayedInSession: checkIn.matchesPlayedInSession ?? 0,
    lastMatchEndedAt: checkIn.lastMatchEndedAt ?? null,
    suggestionExcluded: checkIn.suggestionExcluded ?? false,
    paymentStatus: checkIn.paymentStatus as SessionSnapshot["checkIns"][0]["paymentStatus"],
    paymentAmountDue: checkIn.paymentAmountDue,
    paymentAmountPaid: checkIn.paymentAmountPaid,
  };
}

function mapQueuedMatch(queuedMatch: LocalQueuedMatch) {
  return {
    id: queuedMatch.id,
    laneId: queuedMatch.queueLaneId,
    status: queuedMatch.status as SessionSnapshot["queuedMatches"][0]["status"],
    participants: queuedMatch.participants.map((participant) => ({
      checkInId: participant.checkInId,
      playerProfileId: participant.playerProfileId,
    })),
  };
}

function mapMatch(match: LocalMatch) {
  return {
    id: match.id,
    courtId: match.courtId,
    status: match.status as SessionSnapshot["matches"][0]["status"],
    outcome: (match.outcome ?? null) as SessionSnapshot["matches"][0]["outcome"],
    winningTeam: match.winningTeam ?? null,
    startedAt: match.startedAt ?? null,
    endedAt: match.endedAt ?? null,
    completedAt: match.completedAt ?? null,
    participants: match.participants.map((participant) => ({
      checkInId: participant.checkInId,
      playerProfileId: participant.playerProfileId,
      team: participant.team,
    })),
  };
}

function mapCourt(court: LocalCourt, matches: LocalMatch[]) {
  const activeMatch = matches.find(
    (match) =>
      match.courtId === court.id &&
      (match.status === "assigned" || match.status === "in_progress"),
  );
  return {
    id: court.id,
    status: (activeMatch ? "occupied" : court.status) as SessionSnapshot["courts"][0]["status"],
    currentMatchId: activeMatch?.id ?? court.currentMatchId ?? null,
  };
}

export async function loadSessionDashboardData(sessionId: string) {
  const [session, checkIns, courts, queueLanes, queuedMatches, matches] = await Promise.all([
    db.sessions.get(sessionId),
    db.checkIns.where("sessionId").equals(sessionId).toArray(),
    db.courts.where("sessionId").equals(sessionId).sortBy("sortOrder"),
    db.queueLanes.where("sessionId").equals(sessionId).sortBy("sortOrder"),
    db.queuedMatches.where("sessionId").equals(sessionId).sortBy("sortOrder"),
    db.matches.where("sessionId").equals(sessionId).toArray(),
  ]);

  return { session, checkIns, courts, queueLanes, queuedMatches, matches };
}

export function buildSessionSnapshotFromData(
  session: LocalSession,
  checkIns: LocalCheckIn[],
  courts: LocalCourt[],
  _queueLanes: LocalQueueLane[],
  queuedMatches: LocalQueuedMatch[],
  matches: LocalMatch[],
  now = new Date().toISOString(),
): SessionSnapshot {
  return {
    session: {
      id: session.id,
      status: session.status as SessionSnapshot["session"]["status"],
      queueMode: session.queueMode,
      ratingMode: session.ratingMode,
    },
    checkIns: checkIns
      .filter((checkIn) => checkIn.queueStatus !== "removed")
      .map(mapCheckIn),
    queuedMatches: queuedMatches
      .filter((queuedMatch) => queuedMatch.status !== "removed")
      .map(mapQueuedMatch),
    matches: matches.map(mapMatch),
    courts: courts.map((court) => mapCourt(court, matches)),
    now,
  };
}

export async function buildSessionSnapshot(
  sessionId: string,
  now = new Date().toISOString(),
): Promise<SessionSnapshot | null> {
  const data = await loadSessionDashboardData(sessionId);
  if (!data.session) {
    return null;
  }
  return buildSessionSnapshotFromData(
    data.session,
    data.checkIns,
    data.courts,
    data.queueLanes,
    data.queuedMatches,
    data.matches,
    now,
  );
}
