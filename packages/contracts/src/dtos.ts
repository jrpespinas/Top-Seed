import { z } from "zod";

export const sessionStatusSchema = z.enum([
  "draft",
  "open",
  "active",
  "completed",
  "cancelled",
]);

export const queueModeSchema = z.enum(["manual", "suggested"]);
export const ratingModeSchema = z.enum(["casual", "rated"]);

export const sessionDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  venueName: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  status: sessionStatusSchema,
  feeAmount: z.number().nonnegative(),
  currency: z.string(),
  queueMode: queueModeSchema,
  requirePaymentBeforePlay: z.boolean().optional(),
  ratingMode: ratingModeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const queueStatusSchema = z.enum([
  "waiting",
  "assigned",
  "playing",
  "resting",
  "done",
  "removed",
]);

export const paymentStatusSchema = z.enum([
  "unpaid",
  "partial",
  "paid",
  "waived",
  "refunded",
]);

export const checkInDtoSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  playerProfileId: z.string(),
  playerDisplayName: z.string(),
  arrivalOrder: z.number().int().nonnegative(),
  checkedInAt: z.string().datetime(),
  queueStatus: queueStatusSchema,
  sessionSkillRating: z.number(),
  paymentStatus: paymentStatusSchema,
  paymentAmountDue: z.number().nonnegative(),
  paymentAmountPaid: z.number().nonnegative(),
  paymentMethod: z.string(),
  paymentNotes: z.string(),
  suggestionExcluded: z.boolean().optional(),
  suggestionExcludeNote: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const leaderboardEntryDtoSchema = z.object({
  playerProfileId: z.string(),
  displayName: z.string(),
  currentRating: z.number(),
  matchesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  draws: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(1).nullable(),
  attendanceCount: z.number().int().nonnegative(),
  rank: z.number().int().positive().optional(),
});

export const paymentCountsByStatusSchema = z.object({
  unpaid: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  paid: z.number().int().nonnegative(),
  waived: z.number().int().nonnegative(),
  refunded: z.number().int().nonnegative(),
});

export const paymentSummaryDtoSchema = z.object({
  expectedTotal: z.number().nonnegative(),
  collectedTotal: z.number().nonnegative(),
  unpaidTotal: z.number().nonnegative(),
  waivedTotal: z.number().nonnegative(),
  refundedTotal: z.number().nonnegative(),
  countsByStatus: paymentCountsByStatusSchema,
  currency: z.string(),
});

export const healthDataSchema = z.object({
  status: z.literal("ok"),
});

export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type CheckInDto = z.infer<typeof checkInDtoSchema>;
export type LeaderboardEntryDto = z.infer<typeof leaderboardEntryDtoSchema>;
export type PaymentSummaryDto = z.infer<typeof paymentSummaryDtoSchema>;
export type HealthData = z.infer<typeof healthDataSchema>;

export const playerProfileDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  displayName: z.string(),
  phone: z.string().optional(),
  defaultSkillRating: z.number(),
  notes: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PlayerProfileDto = z.infer<typeof playerProfileDtoSchema>;
