import { z } from "zod";
import {
  clearPlayerFromOtherQueuedMatches,
  queuedMatchStatusForParticipantCount,
} from "@top-seed/domain";
import {
  createQueuedMatchPayloadSchema,
  moveQueuedMatchToCourtPayloadSchema,
  type SyncParticipantInput,
} from "@top-seed/contracts";
import { db } from "../db/database.js";
import type { LocalQueuedMatch, LocalQueuedMatchParticipant } from "../db/types.js";
import { nextQueuedMatchSortOrder, requireSession } from "../lib/mutation-utils.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export const createQueuedMatchInputSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  queueLaneId: z.string(),
  createdFrom: z.enum(["manual", "suggestion"]).default("manual"),
  participants: z.array(
    z.object({
      checkInId: z.string(),
      playerProfileId: z.string(),
      team: z.enum(["team_one", "team_two"]),
      slotOrder: z.union([z.literal(1), z.literal(2)]),
    }),
  ),
});

export type CreateQueuedMatchInput = z.input<typeof createQueuedMatchInputSchema>;

async function assignParticipantsToQueuedMatch(
  sessionId: string,
  participants: LocalQueuedMatchParticipant[],
) {
  for (const participant of participants) {
    const checkIn = await db.checkIns.get(participant.checkInId);
    if (!checkIn || checkIn.sessionId !== sessionId) {
      throw new Error("Check-in not found.");
    }
    if (checkIn.queueStatus === "playing") {
      throw new Error("Player is already on a court match.");
    }
    await db.checkIns.update(participant.checkInId, { queueStatus: "assigned", syncStatus: "pending" });
  }
}

export async function createQueuedMatchLocal(
  input: CreateQueuedMatchInput,
  options?: { syncActionId?: string; sortOrder?: number },
): Promise<LocalQueuedMatch> {
  const parsed = createQueuedMatchInputSchema.parse(input);

  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(parsed.sessionId);
        const sortOrder =
          options?.sortOrder ??
          (await nextQueuedMatchSortOrder(parsed.sessionId, parsed.queueLaneId));
        const status = queuedMatchStatusForParticipantCount(parsed.participants.length);

        const queuedMatch: LocalQueuedMatch = {
          id: parsed.id,
          sessionId: parsed.sessionId,
          queueLaneId: parsed.queueLaneId,
          status,
          sortOrder,
          createdFrom: parsed.createdFrom,
          participants: parsed.participants,
          syncStatus: "pending",
        };

        await assignParticipantsToQueuedMatch(parsed.sessionId, parsed.participants);
        await db.queuedMatches.put(queuedMatch);

        const payload = createQueuedMatchPayloadSchema.parse({
          sessionId: parsed.sessionId,
          queueLaneId: parsed.queueLaneId,
          sortOrder,
          status,
          createdFrom: parsed.createdFrom,
          participants: parsed.participants as SyncParticipantInput[],
        });

        await enqueueSyncAction({
          id: options?.syncActionId ?? crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "CREATE_QUEUED_MATCH",
          entityType: "queuedMatch",
          entityId: parsed.id,
          sessionId: parsed.sessionId,
          payload,
          createdAt: new Date().toISOString(),
        });

        return queuedMatch;
      }),
  });
}

export async function addEmptyQueuedMatchLocal(input: {
  id: string;
  sessionId: string;
  queueLaneId: string;
}): Promise<LocalQueuedMatch> {
  return createQueuedMatchLocal({
    id: input.id,
    sessionId: input.sessionId,
    queueLaneId: input.queueLaneId,
    createdFrom: "manual",
    participants: [],
  });
}

export async function updateQueuedMatchLocal(input: {
  sessionId: string;
  queuedMatchId: string;
  participants: LocalQueuedMatchParticipant[];
}): Promise<LocalQueuedMatch> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const existing = await db.queuedMatches.get(input.queuedMatchId);
        if (!existing || existing.sessionId !== input.sessionId) {
          throw new Error("Queued match not found.");
        }

        const previousIds = new Set(existing.participants.map((p) => p.checkInId));
        const nextIds = new Set(input.participants.map((p) => p.checkInId));

        for (const checkInId of previousIds) {
          if (!nextIds.has(checkInId)) {
            const stillStaged = await db.queuedMatches
              .where("sessionId")
              .equals(input.sessionId)
              .filter(
                (qm) =>
                  qm.id !== input.queuedMatchId &&
                  (qm.status === "draft" || qm.status === "ready") &&
                  qm.participants.some((p) => p.checkInId === checkInId),
              )
              .count();
            const onCourt = await db.matches
              .where("sessionId")
              .equals(input.sessionId)
              .filter(
                (match) =>
                  (match.status === "assigned" || match.status === "in_progress") &&
                  match.participants.some((p) => p.checkInId === checkInId),
              )
              .count();
            if (stillStaged === 0 && onCourt === 0) {
              await db.checkIns.update(checkInId, { queueStatus: "waiting" });
            }
          }
        }

        for (const participant of input.participants) {
          if (!previousIds.has(participant.checkInId)) {
            await db.checkIns.update(participant.checkInId, { queueStatus: "assigned" });
          }
        }

        const status = queuedMatchStatusForParticipantCount(input.participants.length);
        const updated: LocalQueuedMatch = {
          ...existing,
          participants: input.participants,
          status,
          syncStatus: "pending",
        };
        await db.queuedMatches.put(updated);
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "UPDATE_QUEUED_MATCH",
          entityType: "queuedMatch",
          entityId: input.queuedMatchId,
          sessionId: input.sessionId,
          payload: {
            queueLaneId: existing.queueLaneId,
            sortOrder: existing.sortOrder,
            status,
            participants: input.participants,
          },
          createdAt: new Date().toISOString(),
        });
        return updated;
      }),
  });
}

export async function removeQueuedMatchLocal(input: {
  sessionId: string;
  queuedMatchId: string;
}): Promise<void> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const existing = await db.queuedMatches.get(input.queuedMatchId);
        if (!existing) {
          return;
        }
        for (const participant of existing.participants) {
          const stillStaged = await db.queuedMatches
            .where("sessionId")
            .equals(input.sessionId)
            .filter(
              (qm) =>
                qm.id !== input.queuedMatchId &&
                (qm.status === "draft" || qm.status === "ready") &&
                qm.participants.some((p) => p.checkInId === participant.checkInId),
            )
            .count();
          if (stillStaged === 0) {
            await db.checkIns.update(participant.checkInId, { queueStatus: "waiting" });
          }
        }
        await db.queuedMatches.update(input.queuedMatchId, {
          status: "removed",
          participants: [],
        });
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "REMOVE_QUEUED_MATCH",
          entityType: "queuedMatch",
          entityId: input.queuedMatchId,
          sessionId: input.sessionId,
          payload: {},
          createdAt: new Date().toISOString(),
        });
      }),
  });
}

export async function moveQueuedMatchToLaneLocal(input: {
  sessionId: string;
  queuedMatchId: string;
  targetQueueLaneId: string;
  sortOrder: number;
}): Promise<LocalQueuedMatch> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const existing = await db.queuedMatches.get(input.queuedMatchId);
        if (!existing) {
          throw new Error("Queued match not found.");
        }
        const updated = {
          ...existing,
          queueLaneId: input.targetQueueLaneId,
          sortOrder: input.sortOrder,
          syncStatus: "pending" as const,
        };
        await db.queuedMatches.put(updated);
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "MOVE_QUEUED_MATCH_TO_LANE",
          entityType: "queuedMatch",
          entityId: input.queuedMatchId,
          sessionId: input.sessionId,
          payload: {
            targetQueueLaneId: input.targetQueueLaneId,
            sortOrder: input.sortOrder,
          },
          createdAt: new Date().toISOString(),
        });
        return updated;
      }),
  });
}

export async function moveQueuedMatchToCourtLocal(input: {
  sessionId: string;
  queuedMatchId: string;
  courtId: string;
  matchId: string;
  assignedAt: string;
}): Promise<{ matchId: string }> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const queuedMatch = await db.queuedMatches.get(input.queuedMatchId);
        if (!queuedMatch || queuedMatch.status !== "ready") {
          throw new Error("Queued match is not ready to send to court.");
        }

        const court = await db.courts.get(input.courtId);
        if (!court || court.status === "paused" || court.status === "unavailable") {
          throw new Error("Court is not available.");
        }

        const activeOnCourt = await db.matches
          .where({ sessionId: input.sessionId, courtId: input.courtId })
          .filter((match) => match.status === "assigned" || match.status === "in_progress")
          .count();
        if (activeOnCourt > 0) {
          throw new Error("Court already has an active match.");
        }

        const allQueued = await db.queuedMatches.where("sessionId").equals(input.sessionId).toArray();
        const participantCheckInIds = queuedMatch.participants.map((p) => p.checkInId);
        const cleared = clearPlayerFromOtherQueuedMatches(
          queuedMatch.id,
          participantCheckInIds,
          allQueued.map((qm) => ({
            id: qm.id,
            laneId: qm.queueLaneId,
            status: qm.status as "draft" | "ready" | "promoted" | "removed",
            participants: qm.participants.map((p) => ({
              checkInId: p.checkInId,
              playerProfileId: p.playerProfileId,
            })),
          })),
        );

        for (const qm of cleared) {
          if (qm.id === queuedMatch.id) {
            continue;
          }
          const original = allQueued.find((x) => x.id === qm.id);
          if (!original) {
            continue;
          }
          await db.queuedMatches.put({
            ...original,
            participants: qm.participants.map((p) => {
              const existingParticipant = original.participants.find(
                (x) => x.checkInId === p.checkInId,
              );
              return (
                existingParticipant ?? {
                  checkInId: p.checkInId,
                  playerProfileId: p.playerProfileId,
                  team: "team_one" as const,
                  slotOrder: 1 as const,
                }
              );
            }),
            status: qm.status,
          });
          for (const removed of original.participants) {
            if (!qm.participants.some((p) => p.checkInId === removed.checkInId)) {
              const stillStaged = cleared.some(
                (other) =>
                  other.id !== qm.id &&
                  (other.status === "draft" || other.status === "ready") &&
                  other.participants.some((p) => p.checkInId === removed.checkInId),
              );
              if (!stillStaged) {
                await db.checkIns.update(removed.checkInId, { queueStatus: "waiting" });
              }
            }
          }
        }

        const checkIns = await db.checkIns.bulkGet(participantCheckInIds);
        const ratingByCheckIn = new Map(
          checkIns.filter(Boolean).map((checkIn) => [checkIn!.id, checkIn!.sessionSkillRating]),
        );

        await db.matches.put({
          id: input.matchId,
          sessionId: input.sessionId,
          courtId: input.courtId,
          queuedMatchId: input.queuedMatchId,
          status: "assigned",
          outcome: null,
          winningTeam: null,
          participants: queuedMatch.participants.map((participant) => ({
            checkInId: participant.checkInId,
            playerProfileId: participant.playerProfileId,
            team: participant.team,
            ratingBefore: ratingByCheckIn.get(participant.checkInId) ?? 3,
          })),
          syncStatus: "pending",
        });

        await db.queuedMatches.update(input.queuedMatchId, { status: "promoted" });
        await db.courts.update(input.courtId, {
          status: "occupied",
          currentMatchId: input.matchId,
        });

        const payload = moveQueuedMatchToCourtPayloadSchema.parse({
          courtId: input.courtId,
          matchId: input.matchId,
          assignedAt: input.assignedAt,
        });

        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "MOVE_QUEUED_MATCH_TO_COURT",
          entityType: "queuedMatch",
          entityId: input.queuedMatchId,
          sessionId: input.sessionId,
          payload,
          createdAt: input.assignedAt,
        });

        return { matchId: input.matchId };
      }),
  });
}
