import { z } from "zod";
import { updateCheckInPayloadSchema } from "@top-seed/contracts";
import { validateMarkDoneOrRemoved } from "@top-seed/domain";
import { db } from "../db/database.js";
import type { LocalCheckIn } from "../db/types.js";
import { requireSession } from "../lib/mutation-utils.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export const updateCheckInInputSchema = z.object({
  checkInId: z.string(),
  sessionId: z.string(),
  queueStatus: z
    .enum(["waiting", "assigned", "playing", "resting", "done", "removed"])
    .optional(),
  sessionSkillRating: z.number().optional(),
  suggestionExcluded: z.boolean().optional(),
  suggestionExcludeNote: z.string().optional().nullable(),
  paymentStatus: z.enum(["unpaid", "partial", "paid", "waived", "refunded"]).optional(),
  paymentAmountPaid: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  paymentNotes: z.string().optional(),
});

export type UpdateCheckInInput = z.infer<typeof updateCheckInInputSchema>;

export async function updateCheckInLocal(
  input: UpdateCheckInInput,
  options?: { syncActionId?: string },
): Promise<LocalCheckIn> {
  const parsed = updateCheckInInputSchema.parse(input);

  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(parsed.sessionId);
        const existing = await db.checkIns.get(parsed.checkInId);
        if (!existing || existing.sessionId !== parsed.sessionId) {
          throw new Error("Check-in not found.");
        }

        if (parsed.queueStatus === "done" || parsed.queueStatus === "removed") {
          const validation = validateMarkDoneOrRemoved(
            existing.queueStatus as Parameters<typeof validateMarkDoneOrRemoved>[0],
          );
          if (!validation.ok) {
            throw new Error(validation.message);
          }
        }

        const updated: LocalCheckIn = {
          ...existing,
          queueStatus: parsed.queueStatus ?? existing.queueStatus,
          sessionSkillRating: parsed.sessionSkillRating ?? existing.sessionSkillRating,
          suggestionExcluded: parsed.suggestionExcluded ?? existing.suggestionExcluded,
          suggestionExcludeNote:
            parsed.suggestionExcludeNote === undefined
              ? existing.suggestionExcludeNote
              : parsed.suggestionExcludeNote ?? undefined,
          paymentStatus: parsed.paymentStatus ?? existing.paymentStatus,
          paymentAmountPaid: parsed.paymentAmountPaid ?? existing.paymentAmountPaid,
          paymentMethod: parsed.paymentMethod ?? existing.paymentMethod,
          paymentNotes: parsed.paymentNotes ?? existing.paymentNotes,
          syncStatus: "pending",
        };

        const payload = updateCheckInPayloadSchema.parse({
          queueStatus: parsed.queueStatus,
          sessionSkillRating: parsed.sessionSkillRating,
          suggestionExcluded: parsed.suggestionExcluded,
          suggestionExcludeNote: parsed.suggestionExcludeNote,
          paymentStatus: parsed.paymentStatus,
          paymentAmountPaid: parsed.paymentAmountPaid,
          paymentMethod: parsed.paymentMethod,
          paymentNotes: parsed.paymentNotes,
        });

        await db.checkIns.put(updated);
        await enqueueSyncAction({
          id: options?.syncActionId ?? crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "UPDATE_CHECK_IN",
          entityType: "checkIn",
          entityId: parsed.checkInId,
          sessionId: parsed.sessionId,
          payload,
          createdAt: new Date().toISOString(),
        });

        return updated;
      }),
  });
}
