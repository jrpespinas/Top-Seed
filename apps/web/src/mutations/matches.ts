import {
  applyRatingDelta,
  computeMatchRatingDeltas,
  courtStatusAfterMatchEnd,
  resolvePostMatchQueueStatus,
  validateCompleteMatch,
  validateStartMatch,
} from "@top-seed/domain";
import {
  completeMatchPayloadSchema,
  startMatchPayloadSchema,
  type MatchResultInput,
} from "@top-seed/contracts";
import { db } from "../db/database.js";
import type { LocalMatch } from "../db/types.js";
import { requireSession } from "../lib/mutation-utils.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export async function startMatchLocal(input: {
  sessionId: string;
  matchId: string;
  startedAt: string;
}): Promise<LocalMatch> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const match = await db.matches.get(input.matchId);
        if (!match || match.sessionId !== input.sessionId) {
          throw new Error("Match not found.");
        }

        const validation = validateStartMatch({
          id: match.id,
          courtId: match.courtId,
          status: match.status as "assigned" | "in_progress" | "completed" | "cancelled",
          outcome: (match.outcome ?? null) as Parameters<typeof validateStartMatch>[0]["outcome"],
          winningTeam: match.winningTeam ?? null,
          startedAt: match.startedAt ?? null,
          endedAt: match.endedAt ?? null,
          completedAt: match.completedAt ?? null,
          participants: match.participants,
        });
        if (!validation.ok) {
          throw new Error(validation.message);
        }

        const updated: LocalMatch = {
          ...match,
          status: "in_progress",
          startedAt: input.startedAt,
          syncStatus: "pending",
        };
        await db.matches.put(updated);
        for (const participant of match.participants) {
          await db.checkIns.update(participant.checkInId, {
            queueStatus: "playing",
            syncStatus: "pending",
          });
        }

        const payload = startMatchPayloadSchema.parse({ startedAt: input.startedAt });
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "START_MATCH",
          entityType: "match",
          entityId: input.matchId,
          sessionId: input.sessionId,
          payload,
          createdAt: input.startedAt,
        });

        return updated;
      }),
  });
}

export async function completeMatchLocal(input: {
  sessionId: string;
  matchId: string;
  result: MatchResultInput;
}): Promise<LocalMatch> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const match = await db.matches.get(input.matchId);
        if (!match || match.sessionId !== input.sessionId) {
          throw new Error("Match not found.");
        }

        const validation = validateCompleteMatch({
          id: match.id,
          courtId: match.courtId,
          status: match.status as "assigned" | "in_progress" | "completed" | "cancelled",
          outcome: (match.outcome ?? null) as Parameters<typeof validateCompleteMatch>[0]["outcome"],
          winningTeam: match.winningTeam ?? null,
          startedAt: match.startedAt ?? null,
          endedAt: match.endedAt ?? null,
          completedAt: match.completedAt ?? null,
          participants: match.participants,
        });
        if (!validation.ok) {
          throw new Error(validation.message);
        }

        const queuedMatches = await db.queuedMatches
          .where("sessionId")
          .equals(input.sessionId)
          .filter((qm) => qm.status === "draft" || qm.status === "ready")
          .toArray();

        const teamOne = match.participants.filter((p) => p.team === "team_one");
        const teamTwo = match.participants.filter((p) => p.team === "team_two");
        const deltas = computeMatchRatingDeltas(
          session.ratingMode,
          input.result.outcome,
          {
            teamOneRatings: teamOne.map((p) => p.ratingBefore ?? 3),
            teamTwoRatings: teamTwo.map((p) => p.ratingBefore ?? 3),
          },
          input.result.winningTeam ?? null,
        );

        const endedAt = input.result.endedAt ?? new Date().toISOString();
        const updatedParticipants = match.participants.map((participant) => {
          if (!deltas) {
            return participant;
          }
          const team = participant.team === "team_one" ? teamOne : teamTwo;
          const teamIndex = team.findIndex((p) => p.checkInId === participant.checkInId);
          const delta =
            participant.team === "team_one"
              ? deltas.teamOneDeltas[teamIndex] ?? 0
              : deltas.teamTwoDeltas[teamIndex] ?? 0;
          const ratingBefore = participant.ratingBefore ?? 3;
          return {
            ...participant,
            ratingDelta: delta,
            ratingAfter: applyRatingDelta(ratingBefore, delta),
          };
        });

        const updated: LocalMatch = {
          ...match,
          status: "completed",
          outcome: input.result.outcome,
          winningTeam: input.result.winningTeam ?? null,
          teamOneScore: input.result.teamOneScore ?? null,
          teamTwoScore: input.result.teamTwoScore ?? null,
          endedAt,
          completedAt: endedAt,
          participants: updatedParticipants,
          syncStatus: "pending",
        };
        await db.matches.put(updated);

        for (const participant of updatedParticipants) {
          const nextStatus = resolvePostMatchQueueStatus(
            participant.checkInId,
            queuedMatches.map((qm) => ({
              id: qm.id,
              laneId: qm.queueLaneId,
              status: qm.status as "draft" | "ready" | "promoted" | "removed",
              participants: qm.participants.map((p) => ({
                checkInId: p.checkInId,
                playerProfileId: p.playerProfileId,
              })),
            })),
          );

          const checkIn = await db.checkIns.get(participant.checkInId);
          if (!checkIn) {
            continue;
          }

          await db.checkIns.update(participant.checkInId, {
            queueStatus: nextStatus,
            matchesPlayedInSession: (checkIn.matchesPlayedInSession ?? 0) + 1,
            lastMatchEndedAt: endedAt,
            sessionSkillRating: participant.ratingAfter ?? checkIn.sessionSkillRating,
            syncStatus: "pending",
          });

          if (session.ratingMode === "rated" && participant.ratingAfter !== undefined) {
            await db.playerProfiles.update(participant.playerProfileId, {
              defaultSkillRating: participant.ratingAfter,
            });
          }
        }

        await db.courts.update(match.courtId, {
          status: courtStatusAfterMatchEnd(),
          currentMatchId: null,
        });

        const payload = completeMatchPayloadSchema.parse(input.result);
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "COMPLETE_MATCH",
          entityType: "match",
          entityId: input.matchId,
          sessionId: input.sessionId,
          payload,
          createdAt: endedAt,
        });

        return updated;
      }),
  });
}

export async function cancelMatchLocal(input: {
  sessionId: string;
  matchId: string;
  cancelledAt?: string;
}): Promise<LocalMatch> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const match = await db.matches.get(input.matchId);
        if (!match) {
          throw new Error("Match not found.");
        }
        const cancelledAt = input.cancelledAt ?? new Date().toISOString();
        const updated: LocalMatch = {
          ...match,
          status: "cancelled",
          outcome: "cancelled",
          endedAt: cancelledAt,
          completedAt: cancelledAt,
          syncStatus: "pending",
        };
        await db.matches.put(updated);
        for (const participant of match.participants) {
          await db.checkIns.update(participant.checkInId, {
            queueStatus: "waiting",
            syncStatus: "pending",
          });
        }
        await db.courts.update(match.courtId, {
          status: courtStatusAfterMatchEnd(),
          currentMatchId: null,
        });
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "CANCEL_MATCH",
          entityType: "match",
          entityId: input.matchId,
          sessionId: input.sessionId,
          payload: { reason: "Organizer cancelled" },
          createdAt: cancelledAt,
        });
        return updated;
      }),
  });
}
