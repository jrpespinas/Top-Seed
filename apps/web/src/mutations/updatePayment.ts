import { applyMutation, runInTransaction } from "./applyMutation.js";
import { db } from "../db/database.js";
import type { LocalCheckIn } from "../db/types.js";
import { requireSession } from "../lib/mutation-utils.js";
import { enqueueSyncAction } from "../sync/outbox.js";
import { updatePaymentPayloadSchema, type UpdatePaymentPayload } from "@top-seed/contracts";
import type { PaymentFields } from "../lib/payment-actions.js";

export async function updatePaymentLocal(
  input: {
    sessionId: string;
    checkInId: string;
    payment: PaymentFields;
  },
  options?: { syncActionId?: string },
): Promise<LocalCheckIn> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const existing = await db.checkIns.get(input.checkInId);
        if (!existing || existing.sessionId !== input.sessionId) {
          throw new Error("Check-in not found.");
        }

        const updatedAt = new Date().toISOString();
        const payload: UpdatePaymentPayload = updatePaymentPayloadSchema.parse({
          ...input.payment,
          updatedAt,
        });

        const updated: LocalCheckIn = {
          ...existing,
          paymentStatus: payload.paymentStatus,
          paymentAmountDue: payload.paymentAmountDue,
          paymentAmountPaid: payload.paymentAmountPaid,
          paymentMethod: payload.paymentMethod,
          paymentNotes: payload.paymentNotes,
          syncStatus: "pending",
        };

        await db.checkIns.put(updated);
        await enqueueSyncAction({
          id: options?.syncActionId ?? crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "UPDATE_PAYMENT",
          entityType: "checkIn",
          entityId: input.checkInId,
          sessionId: input.sessionId,
          payload,
          createdAt: updatedAt,
        });

        return updated;
      }),
  });
}
