import { describe, expect, it } from "vitest";
import {
  checkInDtoSchema,
  createDataEnvelopeSchema,
  createListEnvelopeSchema,
  errorEnvelopeSchema,
  healthDataSchema,
  leaderboardEntryDtoSchema,
  paymentSummaryDtoSchema,
  sessionDtoSchema,
} from "./index.js";

describe("response envelopes", () => {
  it("parses a data envelope", () => {
    const schema = createDataEnvelopeSchema(healthDataSchema);
    const result = schema.parse({
      data: { status: "ok" },
      meta: { serverTime: "2026-06-09T00:00:00.000Z" },
    });
    expect(result.data.status).toBe("ok");
  });

  it("parses a list envelope", () => {
    const schema = createListEnvelopeSchema(sessionDtoSchema);
    const result = schema.parse({
      data: [],
      page: { nextCursor: null, hasMore: false, limit: 50 },
      meta: { serverTime: "2026-06-09T00:00:00.000Z" },
    });
    expect(result.page.hasMore).toBe(false);
  });

  it("parses an error envelope", () => {
    const result = errorEnvelopeSchema.parse({
      error: {
        code: "COURT_ALREADY_OCCUPIED",
        message: "Court 1 already has an active match.",
        details: { courtId: "court-1" },
      },
      meta: { serverTime: "2026-06-09T00:00:00.000Z" },
    });
    expect(result.error.code).toBe("COURT_ALREADY_OCCUPIED");
  });

  it("rejects invalid envelope shape", () => {
    const schema = createDataEnvelopeSchema(healthDataSchema);
    expect(() => schema.parse({ data: { status: "bad" } })).toThrow();
  });
});

describe("stub DTOs", () => {
  const sessionFixture = {
    id: "session-1",
    organizationId: "org-default",
    name: "Friday Open Play",
    venueName: "Main Hall",
    startsAt: "2026-06-09T18:00:00.000Z",
    endsAt: null,
    status: "active" as const,
    feeAmount: 250,
    currency: "PHP",
    queueMode: "suggested" as const,
    requirePaymentBeforePlay: false,
    ratingMode: "casual" as const,
    createdAt: "2026-06-09T17:00:00.000Z",
    updatedAt: "2026-06-09T17:00:00.000Z",
  };

  it("parses SessionDto", () => {
    expect(sessionDtoSchema.parse(sessionFixture).name).toBe("Friday Open Play");
  });

  it("parses CheckInDto", () => {
    const result = checkInDtoSchema.parse({
      id: "checkin-1",
      sessionId: "session-1",
      playerProfileId: "player-1",
      playerDisplayName: "Ana",
      arrivalOrder: 1,
      checkedInAt: "2026-06-09T18:05:00.000Z",
      queueStatus: "waiting",
      sessionSkillRating: 3.5,
      paymentStatus: "unpaid",
      paymentAmountDue: 250,
      paymentAmountPaid: 0,
      paymentMethod: "none",
      paymentNotes: "",
      createdAt: "2026-06-09T18:05:00.000Z",
      updatedAt: "2026-06-09T18:05:00.000Z",
    });
    expect(result.playerDisplayName).toBe("Ana");
  });

  it("parses LeaderboardEntryDto", () => {
    const result = leaderboardEntryDtoSchema.parse({
      playerProfileId: "player-1",
      displayName: "Ana",
      currentRating: 3.5,
      matchesPlayed: 4,
      wins: 3,
      losses: 1,
      draws: 0,
      winRate: 0.75,
      attendanceCount: 1,
    });
    expect(result.wins).toBe(3);
  });

  it("parses PaymentSummaryDto", () => {
    const result = paymentSummaryDtoSchema.parse({
      expectedTotal: 5000,
      collectedTotal: 3000,
      unpaidTotal: 2000,
      waivedTotal: 0,
      refundedTotal: 0,
      countsByStatus: {
        unpaid: 8,
        partial: 0,
        paid: 12,
        waived: 0,
        refunded: 0,
      },
      currency: "PHP",
    });
    expect(result.collectedTotal).toBe(3000);
  });
});
