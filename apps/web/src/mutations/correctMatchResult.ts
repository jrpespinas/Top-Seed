import { z } from "zod";
import { recomputeSessionFromMatches } from "@top-seed/domain";
import {
  updateMatchResultPayloadSchema,
  type UpdateMatchResultPayload,
} from "@top-seed/contracts";
import { db } from "../db/database.js";
import type { LocalMatch } from "../db/types.js";
import { requireSession } from "../lib/mutation-utils.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export const correctMatchResultInputSchema = updateMatchResultPayloadSchema;

export async function correctMatchResultLocal(
  input: {
    sessionId: string;
    matchId: string;
    result: UpdateMatchResultPayload;
  },
  options?: { syncActionId?: string },
): Promise<LocalMatch> {
  const parsed = correctMatchResultInputSchema.parse(input.result);

  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const match = await db.matches.get(input.matchId);
        if (!match || match.sessionId !== input.sessionId) {
          throw new Error("Match not found.");
        }

        if (match.status !== "completed") {
          throw new Error("Match must be completed before correction.");
        }

        const updatedMatch: LocalMatch = {
          ...match,
          outcome: parsed.outcome,
          winningTeam: parsed.winningTeam ?? null,
          teamOneScore: parsed.teamOneScore ?? null,
          teamTwoScore: parsed.teamTwoScore ?? null,
          syncStatus: "pending",
        };
        await db.matches.put(updatedMatch);

        const allMatches = await db.matches.where("sessionId").equals(input.sessionId).toArray();
        const completedMatches = allMatches
          .map((row) => {
            if (row.status !== "completed" || !row.outcome || !row.completedAt) {
              return null;
            }
            const current = row.id === updatedMatch.id ? updatedMatch : row;
            return {
              id: current.id,
              completedAt: current.completedAt!,
              outcome: current.outcome as "team_one_win" | "team_two_win" | "draw" | "unscored" | "cancelled",
              winningTeam: current.winningTeam ?? null,
              participants: current.participants.map((participant) => ({
                playerProfileId: participant.playerProfileId,
                team: participant.team,
                ratingBefore: participant.ratingBefore ?? 3,
              })),
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null && row.outcome !== "cancelled");

        const profiles = await db.playerProfiles.toArray();
        const initialRatings = new Map(
          profiles.map((profile) => [profile.id, profile.defaultSkillRating]),
        );

        const recompute = recomputeSessionFromMatches(
          completedMatches,
          initialRatings,
          session.ratingMode,
        );

        for (const row of allMatches) {
          if (row.status !== "completed") {
            continue;
          }
          const deltas = recompute.matchDeltas.get(row.id);
          if (!deltas) {
            continue;
          }
          const participants = row.participants.map((participant) => {
            const delta = deltas.get(participant.playerProfileId) ?? 0;
            const ratingBefore = participant.ratingBefore ?? 3;
            const ratingAfter =
              recompute.ratingsByPlayer.get(participant.playerProfileId) ?? ratingBefore;
            return {
              ...participant,
              ratingDelta: delta,
              ratingAfter,
            };
          });
          await db.matches.update(row.id, { participants });
        }

        for (const [playerProfileId, rating] of recompute.ratingsByPlayer.entries()) {
          await db.playerProfiles.update(playerProfileId, { defaultSkillRating: rating });
          const checkIns = await db.checkIns
            .where({ sessionId: input.sessionId, playerProfileId })
            .toArray();
          for (const checkIn of checkIns) {
            await db.checkIns.update(checkIn.id, {
              sessionSkillRating: rating,
              syncStatus: "pending",
            });
          }
        }

        const correctedAt = new Date().toISOString();
        await enqueueSyncAction({
          id: options?.syncActionId ?? crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "UPDATE_MATCH_RESULT",
          entityType: "match",
          entityId: input.matchId,
          sessionId: input.sessionId,
          payload: parsed,
          createdAt: correctedAt,
        });

        return (await db.matches.get(input.matchId))!;
      }),
  });
}
