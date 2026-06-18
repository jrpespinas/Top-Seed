import { z } from "zod";
import { createPlayerPayloadSchema } from "@top-seed/contracts";
import { db } from "../db/database.js";
import type { LocalPlayerProfile } from "../db/types.js";
import { DEFAULT_ORG_ID } from "../lib/device.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

export const createPlayerInputSchema = z.object({
  id: z.string(),
  organizationId: z.string().default(DEFAULT_ORG_ID),
  displayName: z.string().min(1),
  defaultSkillRating: z.number().default(3),
  phone: z.string().optional(),
});

export type CreatePlayerInput = z.input<typeof createPlayerInputSchema>;

export async function createPlayerLocal(
  input: CreatePlayerInput,
  options?: { syncActionId?: string },
): Promise<LocalPlayerProfile> {
  const parsed = createPlayerInputSchema.parse(input);
  const createdAt = new Date().toISOString();

  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const profile: LocalPlayerProfile = {
          id: parsed.id,
          organizationId: parsed.organizationId,
          displayName: parsed.displayName,
          defaultSkillRating: parsed.defaultSkillRating,
          phone: parsed.phone,
          syncStatus: "pending",
        };

        const payload = createPlayerPayloadSchema.parse({
          organizationId: parsed.organizationId,
          displayName: parsed.displayName,
          defaultSkillRating: parsed.defaultSkillRating,
          phone: parsed.phone,
        });

        await db.playerProfiles.put(profile);
        await enqueueSyncAction({
          id: options?.syncActionId ?? crypto.randomUUID(),
          organizationId: parsed.organizationId,
          type: "CREATE_PLAYER",
          entityType: "playerProfile",
          entityId: parsed.id,
          sessionId: "",
          payload,
          createdAt,
        });

        return profile;
      }),
  });
}
