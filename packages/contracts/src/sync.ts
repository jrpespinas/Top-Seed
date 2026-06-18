import { z } from "zod";
import { isoDateTimeSchema } from "./envelopes.js";

export const syncParticipantInputSchema = z.object({
  playerProfileId: z.string(),
  checkInId: z.string(),
  team: z.enum(["team_one", "team_two"]),
  slotOrder: z.union([z.literal(1), z.literal(2)]),
});

export const matchResultInputSchema = z.object({
  outcome: z.enum(["team_one_win", "team_two_win", "draw", "unscored"]),
  teamOneScore: z.number().int().nonnegative().optional(),
  teamTwoScore: z.number().int().nonnegative().optional(),
  winningTeam: z.enum(["team_one", "team_two"]).optional().nullable(),
  endedAt: isoDateTimeSchema.optional(),
});

export const syncActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  sessionId: z.string().optional(),
  payload: z.record(z.unknown()),
  createdAt: isoDateTimeSchema,
});

export const syncActionsRequestSchema = z.object({
  organizationId: z.string(),
  deviceId: z.string(),
  actions: z.array(syncActionSchema).min(1),
});

export const syncActionResultSchema = z.object({
  actionId: z.string(),
  status: z.enum(["applied", "already_applied", "failed", "blocked"]),
  entityType: z.string(),
  entityId: z.string(),
  canonicalEntityId: z.string().optional(),
  serverVersion: z.number().int().optional(),
  serverUpdatedAt: isoDateTimeSchema.optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
  createdEntities: z
    .array(
      z.object({
        entityType: z.string(),
        clientEntityId: z.string(),
        canonicalEntityId: z.string(),
      }),
    )
    .optional(),
  sideEffects: z
    .object({
      ratingApplied: z.boolean().optional(),
      leaderboardUpdated: z.boolean().optional(),
    })
    .optional(),
});

export const syncActionsResponseSchema = z.object({
  organizationId: z.string(),
  deviceId: z.string(),
  processedAt: isoDateTimeSchema,
  results: z.array(syncActionResultSchema),
});

export const checkInPlayerPayloadSchema = z.object({
  sessionId: z.string(),
  playerProfileId: z.string(),
  arrivalOrder: z.number().int().nonnegative(),
  checkedInAt: isoDateTimeSchema,
  sessionSkillRating: z.number(),
  paymentStatus: z.enum(["unpaid", "partial", "paid", "waived", "refunded"]).optional(),
  paymentAmountDue: z.number().nonnegative().optional(),
  paymentAmountPaid: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  paymentNotes: z.string().optional(),
});

export const createQueuedMatchPayloadSchema = z.object({
  sessionId: z.string(),
  queueLaneId: z.string(),
  sortOrder: z.number().int().nonnegative(),
  status: z.enum(["draft", "ready"]),
  createdFrom: z.enum(["manual", "suggestion"]),
  participants: z.array(syncParticipantInputSchema),
});

export const moveQueuedMatchToCourtPayloadSchema = z.object({
  courtId: z.string(),
  matchId: z.string(),
  assignedAt: isoDateTimeSchema,
});

export const startMatchPayloadSchema = z.object({
  startedAt: isoDateTimeSchema,
});

export const completeMatchPayloadSchema = matchResultInputSchema;

export const createSessionPayloadSchema = z.object({
  name: z.string(),
  venueName: z.string(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.optional().nullable(),
  feeAmount: z.number().nonnegative(),
  currency: z.string(),
  queueMode: z.enum(["suggested", "manual"]),
  ratingMode: z.enum(["casual", "rated"]),
  requirePaymentBeforePlay: z.boolean().optional(),
});

export const startSessionPayloadSchema = z.object({
  startedAt: isoDateTimeSchema.optional(),
});

export const completeSessionPayloadSchema = z.object({
  completedAt: isoDateTimeSchema.optional(),
});

export const createSessionRequestSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  venueName: z.string(),
  startsAt: isoDateTimeSchema,
  feeAmount: z.number().int().nonnegative(),
  currency: z.string().optional(),
  queueMode: z.enum(["suggested", "manual"]).optional(),
  ratingMode: z.enum(["casual", "rated"]).optional(),
  courtCount: z.number().int().min(2).max(8).optional(),
});

export type SyncAction = z.infer<typeof syncActionSchema>;
export type SyncActionsRequest = z.infer<typeof syncActionsRequestSchema>;
export type SyncActionResult = z.infer<typeof syncActionResultSchema>;
export type SyncParticipantInput = z.infer<typeof syncParticipantInputSchema>;
export type MatchResultInput = z.infer<typeof matchResultInputSchema>;
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
