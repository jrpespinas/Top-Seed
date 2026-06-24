import { useCallback, useEffect, useMemo, useState } from "react";
import { buildSuggestion, explainSuggestion } from "@top-seed/domain";
import { liveQuery } from "dexie";
import { db } from "../db/database.js";
import type {
  LocalCheckIn,
  LocalCourt,
  LocalMatch,
  LocalPlayerProfile,
  LocalQueuedMatch,
  LocalQueuedMatchParticipant,
  LocalQueueLane,
  LocalSession,
} from "../db/types.js";
import { buildSessionSnapshotFromData } from "../lib/session-snapshot.js";
import { getSessionMode } from "../lib/session-mode.js";
import { computePaymentSummary } from "@top-seed/domain";
import { flushOutbox } from "../sync/syncEngine.js";
import { getConnectionStatus } from "../sync/connection.js";
import { checkInPlayerLocal } from "../mutations/checkInPlayer.js";
import { createPlayerLocal } from "../mutations/createPlayer.js";
import { updateCheckInLocal } from "../mutations/updateCheckIn.js";
import {
  addEmptyQueuedMatchLocal,
  createQueuedMatchLocal,
  moveQueuedMatchToCourtLocal,
  moveQueuedMatchToLaneLocal,
  removeQueuedMatchLocal,
  updateQueuedMatchLocal,
} from "../mutations/queuedMatches.js";
import {
  createQueueLaneLocal,
  deleteQueueLaneLocal,
  renameQueueLaneLocal,
} from "../mutations/queueLanes.js";
import { createCourtLocal, deleteCourtLocal, normalizeSessionCourtsIfNeeded } from "../mutations/courts.js";
import { cancelMatchLocal, completeMatchLocal, startMatchLocal } from "../mutations/matches.js";
import { completeSessionLocal } from "../mutations/completeSession.js";
import {
  findActiveCheckInForPlayer,
  nextArrivalOrder,
} from "../lib/mutation-utils.js";
import { suggestionToParticipants, openCourts } from "../lib/dashboard-helpers.js";
import {
  addPlayerToQueuedParticipants,
  moveQueuedParticipantToSlot,
  removePlayerFromQueuedParticipants,
  type QueuedMatchSlotOrder,
  type QueuedMatchTeam,
} from "../lib/queued-match-participants.js";
import type { MatchResultInput } from "@top-seed/contracts";

export interface DashboardData {
  session: LocalSession | undefined;
  checkIns: LocalCheckIn[];
  courts: LocalCourt[];
  queueLanes: LocalQueueLane[];
  queuedMatches: LocalQueuedMatch[];
  matches: LocalMatch[];
  playerProfiles: LocalPlayerProfile[];
}

function useLiveDashboardData(sessionId: string): DashboardData {
  const [data, setData] = useState<DashboardData>({
    session: undefined,
    checkIns: [],
    courts: [],
    queueLanes: [],
    queuedMatches: [],
    matches: [],
    playerProfiles: [],
  });

  useEffect(() => {
    const sub = liveQuery(async () => {
      const [session, checkIns, courts, queueLanes, queuedMatches, matches, playerProfiles] =
        await Promise.all([
          db.sessions.get(sessionId),
          db.checkIns.where("sessionId").equals(sessionId).sortBy("arrivalOrder"),
          db.courts.where("sessionId").equals(sessionId).sortBy("sortOrder"),
          db.queueLanes.where("sessionId").equals(sessionId).sortBy("sortOrder"),
          db.queuedMatches.where("sessionId").equals(sessionId).sortBy("sortOrder"),
          db.matches.where("sessionId").equals(sessionId).toArray(),
          db.playerProfiles.toArray(),
        ]);
      return { session, checkIns, courts, queueLanes, queuedMatches, matches, playerProfiles };
    }).subscribe({
      next: (value) => setData(value),
    });
    return () => sub.unsubscribe();
  }, [sessionId]);

  return data;
}

async function afterMutation(sessionId: string) {
  if (getConnectionStatus()) {
    await flushOutbox(sessionId);
  }
}

export function useSessionDashboard(sessionId: string) {
  const data = useLiveDashboardData(sessionId);
  const sessionMode = getSessionMode(data.session?.status ?? "active");
  const isLive = sessionMode === "live";

  useEffect(() => {
    if (!data.session || data.courts.length === 0) {
      return;
    }
    void normalizeSessionCourtsIfNeeded(sessionId).then(() => afterMutation(sessionId));
  }, [
    sessionId,
    data.session?.id,
    data.courts.map((court) => `${court.id}:${court.name}:${court.sortOrder}`).join("|"),
  ]);

  const snapshot = useMemo(() => {
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
    );
  }, [data]);

  const suggestion = useMemo(() => {
    if (!snapshot || data.session?.queueMode === "manual") {
      return null;
    }
    const built = buildSuggestion(snapshot);
    return built
      ? { match: built, explanation: explainSuggestion(built) }
      : null;
  }, [snapshot, data.session?.queueMode]);

  const paymentSummary = useMemo(() => {
    if (!data.session) {
      return null;
    }
    return computePaymentSummary(
      data.checkIns.map((checkIn) => ({
        id: checkIn.id,
        paymentStatus: checkIn.paymentStatus as Parameters<
          typeof computePaymentSummary
        >[0][0]["paymentStatus"],
        paymentAmountDue: checkIn.paymentAmountDue,
        paymentAmountPaid: checkIn.paymentAmountPaid,
      })),
      data.session.feeAmount,
      data.session.currency,
    );
  }, [data.checkIns, data.session]);

  const metrics = useMemo(() => {
    const waiting = data.checkIns.filter((c) => c.queueStatus === "waiting").length;
    const activeMatches = data.matches.filter((m) => m.status === "in_progress").length;
    const openCourtCount = openCourts(data.courts, data.matches).length;
    const unpaid = data.checkIns.filter((c) => c.paymentStatus === "unpaid" || c.paymentStatus === "partial").length;
    return {
      checkedIn: data.checkIns.filter((c) => c.queueStatus !== "removed").length,
      waiting,
      activeMatches,
      openCourts: openCourtCount,
      unpaid,
      collected: paymentSummary?.collectedTotal ?? 0,
    };
  }, [data.checkIns, data.courts, data.matches, paymentSummary]);

  const recentMatches = useMemo(
    () =>
      data.matches
        .filter((m) => m.status === "completed" || m.status === "cancelled")
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
        .slice(0, 5),
    [data.matches],
  );

  const checkInPlayer = useCallback(
    async (input: {
      playerProfileId: string;
      playerDisplayName: string;
      sessionSkillRating?: number;
    }) => {
      if (!data.session) {
        return;
      }
      const duplicate = await findActiveCheckInForPlayer(sessionId, input.playerProfileId);
      if (duplicate) {
        throw new Error("Player is already checked in to this session.");
      }
      const now = new Date().toISOString();
      await checkInPlayerLocal({
        id: crypto.randomUUID(),
        sessionId,
        playerProfileId: input.playerProfileId,
        playerDisplayName: input.playerDisplayName,
        arrivalOrder: await nextArrivalOrder(sessionId),
        checkedInAt: now,
        sessionSkillRating: input.sessionSkillRating ?? 3,
        paymentAmountDue: data.session.feeAmount,
      });
      await afterMutation(sessionId);
    },
    [data.session, sessionId],
  );

  const createAndCheckInWalkIn = useCallback(
    async (displayName: string, sessionSkillRating = 3) => {
      const playerId = crypto.randomUUID();
      await createPlayerLocal({
        id: playerId,
        displayName,
        defaultSkillRating: sessionSkillRating,
      });
      await checkInPlayer({
        playerProfileId: playerId,
        playerDisplayName: displayName,
        sessionSkillRating,
      });
    },
    [checkInPlayer],
  );

  const acceptSuggestion = useCallback(
    async (laneId: string) => {
      if (!suggestion) {
        return;
      }
      await createQueuedMatchLocal({
        id: crypto.randomUUID(),
        sessionId,
        queueLaneId: laneId,
        createdFrom: "suggestion",
        participants: suggestionToParticipants(suggestion.match),
      });
      await afterMutation(sessionId);
    },
    [sessionId, suggestion],
  );

  const sendQueuedMatchToCourt = useCallback(
    async (queuedMatchId: string, courtId: string) => {
      await moveQueuedMatchToCourtLocal({
        sessionId,
        queuedMatchId,
        courtId,
        matchId: crypto.randomUUID(),
        assignedAt: new Date().toISOString(),
      });
      await afterMutation(sessionId);
    },
    [sessionId],
  );

  const updateQueuedMatchParticipants = useCallback(
    async (queuedMatchId: string, participants: LocalQueuedMatchParticipant[]) => {
      await updateQueuedMatchLocal({ sessionId, queuedMatchId, participants });
      await afterMutation(sessionId);
    },
    [sessionId],
  );

  const addPlayerToQueuedSlot = useCallback(
    async (input: {
      queuedMatchId: string;
      checkInId: string;
      team: QueuedMatchTeam;
      slotOrder: QueuedMatchSlotOrder;
    }) => {
      const [queuedMatch, checkIn] = await Promise.all([
        db.queuedMatches.get(input.queuedMatchId),
        db.checkIns.get(input.checkInId),
      ]);
      if (!queuedMatch || queuedMatch.sessionId !== sessionId) {
        throw new Error("Queued match not found.");
      }
      if (queuedMatch.status !== "draft" && queuedMatch.status !== "ready") {
        throw new Error("Match cannot be edited.");
      }
      if (!checkIn || checkIn.sessionId !== sessionId) {
        throw new Error("Check-in not found.");
      }
      if (checkIn.queueStatus !== "waiting" && checkIn.queueStatus !== "resting") {
        throw new Error("Player is not available.");
      }
      const participants = addPlayerToQueuedParticipants(queuedMatch.participants, {
        checkInId: input.checkInId,
        playerProfileId: checkIn.playerProfileId,
        team: input.team,
        slotOrder: input.slotOrder,
      });
      await updateQueuedMatchLocal({ sessionId, queuedMatchId: input.queuedMatchId, participants });
      await afterMutation(sessionId);
    },
    [sessionId],
  );

  const removePlayerFromQueuedSlot = useCallback(
    async (input: { queuedMatchId: string; checkInId: string }) => {
      const queuedMatch = await db.queuedMatches.get(input.queuedMatchId);
      if (!queuedMatch || queuedMatch.sessionId !== sessionId) {
        throw new Error("Queued match not found.");
      }
      const participants = removePlayerFromQueuedParticipants(
        queuedMatch.participants,
        input.checkInId,
      );
      await updateQueuedMatchLocal({ sessionId, queuedMatchId: input.queuedMatchId, participants });
      await afterMutation(sessionId);
    },
    [sessionId],
  );

  const movePlayerInQueuedSlot = useCallback(
    async (input: {
      queuedMatchId: string;
      checkInId: string;
      team: QueuedMatchTeam;
      slotOrder: QueuedMatchSlotOrder;
    }) => {
      const queuedMatch = await db.queuedMatches.get(input.queuedMatchId);
      if (!queuedMatch || queuedMatch.sessionId !== sessionId) {
        throw new Error("Queued match not found.");
      }
      if (queuedMatch.status !== "draft" && queuedMatch.status !== "ready") {
        throw new Error("Match cannot be edited.");
      }
      const participants = moveQueuedParticipantToSlot(queuedMatch.participants, {
        checkInId: input.checkInId,
        team: input.team,
        slotOrder: input.slotOrder,
      });
      await updateQueuedMatchLocal({ sessionId, queuedMatchId: input.queuedMatchId, participants });
      await afterMutation(sessionId);
    },
    [sessionId],
  );

  const moveQueuedMatchToLane = useCallback(
    async (input: {
      queuedMatchId: string;
      targetQueueLaneId: string;
      sortOrder: number;
    }) => {
      await moveQueuedMatchToLaneLocal({
        sessionId,
        queuedMatchId: input.queuedMatchId,
        targetQueueLaneId: input.targetQueueLaneId,
        sortOrder: input.sortOrder,
      });
      await afterMutation(sessionId);
    },
    [sessionId],
  );

  const actions = {
    checkInPlayer,
    createAndCheckInWalkIn,
    updateCheckIn: async (input: Parameters<typeof updateCheckInLocal>[0]) => {
      await updateCheckInLocal(input);
      await afterMutation(sessionId);
    },
    acceptSuggestion,
    addEmptyQueuedMatch: async (laneId: string) => {
      await addEmptyQueuedMatchLocal({
        id: crypto.randomUUID(),
        sessionId,
        queueLaneId: laneId,
      });
      await afterMutation(sessionId);
    },
    removeQueuedMatch: async (queuedMatchId: string) => {
      await removeQueuedMatchLocal({ sessionId, queuedMatchId });
      await afterMutation(sessionId);
    },
    addPlayerToQueuedSlot,
    removePlayerFromQueuedSlot,
    movePlayerInQueuedSlot,
    updateQueuedMatchParticipants,
    moveQueuedMatchToLane,
    sendQueuedMatchToCourt,
    startMatch: async (matchId: string) => {
      await startMatchLocal({
        sessionId,
        matchId,
        startedAt: new Date().toISOString(),
      });
      await afterMutation(sessionId);
    },
    completeMatch: async (matchId: string, result: MatchResultInput) => {
      await completeMatchLocal({ sessionId, matchId, result });
      await afterMutation(sessionId);
    },
    cancelMatch: async (matchId: string) => {
      await cancelMatchLocal({ sessionId, matchId });
      await afterMutation(sessionId);
    },
    completeSession: async () => {
      await completeSessionLocal(sessionId);
      await afterMutation(sessionId);
    },
    addQueueLane: async () => {
      const lanes = data.queueLanes.filter((lane) => lane.status !== "deleted");
      await createQueueLaneLocal({
        id: crypto.randomUUID(),
        sessionId,
        name: `Queue ${lanes.length + 1}`,
        sortOrder: lanes.length,
      });
      await afterMutation(sessionId);
    },
    renameQueueLane: async (laneId: string, name: string) => {
      await renameQueueLaneLocal({ sessionId, laneId, name });
      await afterMutation(sessionId);
    },
    deleteQueueLane: async (laneId: string) => {
      await deleteQueueLaneLocal({ sessionId, laneId });
      await afterMutation(sessionId);
    },
    addCourt: async () => {
      await createCourtLocal({
        id: crypto.randomUUID(),
        sessionId,
      });
      await afterMutation(sessionId);
    },
    deleteCourt: async (courtId: string) => {
      await deleteCourtLocal({ sessionId, courtId });
      await afterMutation(sessionId);
    },
  };

  return {
    ...data,
    sessionMode,
    isLive,
    suggestion,
    paymentSummary,
    metrics,
    recentMatches,
    openCourtIds: openCourts(data.courts, data.matches),
    actions,
  };
}
