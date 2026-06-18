import { z } from "zod";
import { checkInInitialStatus } from "@top-seed/domain";
import { checkInPlayerPayloadSchema } from "@top-seed/contracts";
import { db } from "../db/database.js";
import type { LocalCheckIn } from "../db/types.js";
import { DEFAULT_ORG_ID } from "../lib/device.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export const checkInPlayerInputSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  playerProfileId: z.string(),
  playerDisplayName: z.string(),
  arrivalOrder: z.number().int().nonnegative(),
  checkedInAt: z.string().datetime(),
  sessionSkillRating: z.number(),
  paymentAmountDue: z.number().int().nonnegative(),
});

export type CheckInPlayerInput = z.infer<typeof checkInPlayerInputSchema>;

export async function checkInPlayerLocal(
  input: CheckInPlayerInput,
  options?: { syncActionId?: string },
): Promise<LocalCheckIn> {
  const parsed = checkInPlayerInputSchema.parse(input);

  return applyMutation({
    run: async () => {
      return runInTransaction(async () => {
        const session = await db.sessions.get(parsed.sessionId);
        if (!session) {
          throw new Error("Session not found in local store.");
        }

        const actionId = options?.syncActionId ?? crypto.randomUUID();
        const payload = checkInPlayerPayloadSchema.parse({
          sessionId: parsed.sessionId,
          playerProfileId: parsed.playerProfileId,
          arrivalOrder: parsed.arrivalOrder,
          checkedInAt: parsed.checkedInAt,
          sessionSkillRating: parsed.sessionSkillRating,
          paymentAmountDue: parsed.paymentAmountDue,
          paymentAmountPaid: 0,
          paymentMethod: "none",
          paymentNotes: "",
        });

        const checkIn: LocalCheckIn = {
          id: parsed.id,
          sessionId: parsed.sessionId,
          playerProfileId: parsed.playerProfileId,
          playerDisplayName: parsed.playerDisplayName,
          arrivalOrder: parsed.arrivalOrder,
          checkedInAt: parsed.checkedInAt,
          queueStatus: checkInInitialStatus(),
          sessionSkillRating: parsed.sessionSkillRating,
          paymentStatus: "unpaid",
          paymentAmountDue: parsed.paymentAmountDue,
          paymentAmountPaid: 0,
          paymentMethod: "none",
          paymentNotes: "",
          matchesPlayedInSession: 0,
          lastMatchEndedAt: null,
          suggestionExcluded: false,
          syncStatus: "pending",
        };

        await db.checkIns.put(checkIn);
        await enqueueSyncAction({
          id: actionId,
          organizationId: session.organizationId ?? DEFAULT_ORG_ID,
          type: "CHECK_IN_PLAYER",
          entityType: "checkIn",
          entityId: parsed.id,
          sessionId: parsed.sessionId,
          payload,
          createdAt: parsed.checkedInAt,
        });

        return checkIn;
      });
    },
  });
}
