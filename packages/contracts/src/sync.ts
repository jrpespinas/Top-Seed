import { z } from "zod";
import { isoDateTimeSchema } from "./envelopes.js";
import { paymentStatusSchema } from "./dtos.js";

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

export const createQueueLanePayloadSchema = z.object({
  sessionId: z.string(),
  name: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});

export const updateQueueLanePayloadSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  status: z.string().optional(),
});

export const deleteQueueLanePayloadSchema = z.object({
  deleteQueuedMatches: z.boolean().optional(),
});

export const reorderQueueLanesPayloadSchema = z.object({
  orderedLaneIds: z.array(z.string()).min(1),
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

export const removeQueuedMatchPayloadSchema = z.object({});

export const createCourtPayloadSchema = z.object({
  sessionId: z.string(),
  name: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  status: z.enum(["open", "occupied", "paused", "unavailable"]).optional(),
});

export const deleteCourtPayloadSchema = z.object({
  name: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  status: z.enum(["open", "occupied", "paused", "unavailable"]).optional(),
});

export const updateCourtPayloadSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  status: z.enum(["open", "occupied", "paused", "unavailable"]).optional(),
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
export const updateCheckInPayloadSchema = z.object({
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

export const createPlayerProfilePayloadSchema = z.object({
  organizationId: z.string(),
  displayName: z.string().min(1),
  defaultSkillRating: z.number().default(3),
  phone: z.string().optional(),
  gender: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

/** @deprecated Prefer createPlayerProfilePayloadSchema */
export const createPlayerPayloadSchema = createPlayerProfilePayloadSchema;

export type UpdateCheckInPayload = z.infer<typeof updateCheckInPayloadSchema>;
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const updatePaymentPayloadSchema = z.object({
  paymentStatus: paymentStatusSchema,
  paymentAmountDue: z.number().nonnegative(),
  paymentAmountPaid: z.number().nonnegative(),
  paymentMethod: z.string(),
  paymentNotes: z.string(),
  updatedAt: isoDateTimeSchema,
});

export const updateMatchResultPayloadSchema = matchResultInputSchema.extend({
  correctionNote: z.string().optional(),
});

export const updatePlayerProfilePayloadSchema = z.object({
  displayName: z.string().min(1),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  defaultSkillRating: z.number().min(1).max(5),
  notes: z.string().optional().nullable(),
});

export type UpdatePaymentPayload = z.infer<typeof updatePaymentPayloadSchema>;
export type UpdateMatchResultPayload = z.infer<typeof updateMatchResultPayloadSchema>;
export type UpdatePlayerProfilePayload = z.infer<typeof updatePlayerProfilePayloadSchema>;
