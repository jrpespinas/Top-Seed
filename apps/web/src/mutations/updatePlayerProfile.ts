import { z } from "zod";
import { updatePlayerProfilePayloadSchema } from "@top-seed/contracts";
import { db } from "../db/database.js";
import type { LocalPlayerProfile } from "../db/types.js";
import { DEFAULT_ORG_ID } from "../lib/device.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export const updatePlayerProfileInputSchema = z.object({
  playerProfileId: z.string(),
  organizationId: z.string().default(DEFAULT_ORG_ID),
  displayName: z.string().min(1),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  defaultSkillRating: z.number().min(1).max(5),
  notes: z.string().optional().nullable(),
});

export type UpdatePlayerProfileInput = z.input<typeof updatePlayerProfileInputSchema>;

export async function updatePlayerProfileLocal(
  input: UpdatePlayerProfileInput,
  options?: { syncActionId?: string },
): Promise<LocalPlayerProfile> {
  const parsed = updatePlayerProfileInputSchema.parse(input);

  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const existing = await db.playerProfiles.get(parsed.playerProfileId);
        if (!existing) {
          throw new Error("Player profile not found.");
        }

        const payload = updatePlayerProfilePayloadSchema.parse({
          displayName: parsed.displayName,
          phone: parsed.phone ?? undefined,
          gender: parsed.gender ?? undefined,
          defaultSkillRating: parsed.defaultSkillRating,
          notes: parsed.notes ?? undefined,
        });

        const updated: LocalPlayerProfile = {
          ...existing,
          displayName: parsed.displayName,
          phone: parsed.phone ?? undefined,
          gender: parsed.gender ?? undefined,
          defaultSkillRating: parsed.defaultSkillRating,
          notes: parsed.notes ?? undefined,
          syncStatus: "pending",
        };

        await db.playerProfiles.put(updated);
        await enqueueSyncAction({
          id: options?.syncActionId ?? crypto.randomUUID(),
          organizationId: parsed.organizationId,
          type: "UPDATE_PLAYER_PROFILE",
          entityType: "playerProfile",
          entityId: parsed.playerProfileId,
          sessionId: "",
          payload,
          createdAt: new Date().toISOString(),
        });

        return updated;
      }),
  });
}
