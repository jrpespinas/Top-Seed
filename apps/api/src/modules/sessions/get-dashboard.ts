import { buildSuggestion, computePaymentSummary } from "@top-seed/domain";
import type { CheckInDto, SessionDto } from "@top-seed/contracts";
import { prisma } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError } from "../../shared/application/errors.js";

export async function getSessionDashboard(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new UseCaseError("VALIDATION_ERROR", "Session not found.");
  }

  const [courts, checkIns, queueLanes, queuedMatches, matches] = await Promise.all([
    prisma.court.findMany({ where: { sessionId }, orderBy: { sortOrder: "asc" } }),
    prisma.checkIn.findMany({
      where: { sessionId },
      include: { playerProfile: true },
      orderBy: { arrivalOrder: "asc" },
    }),
    prisma.queueLane.findMany({ where: { sessionId }, orderBy: { sortOrder: "asc" } }),
    prisma.queuedMatch.findMany({
      where: { sessionId, status: { in: ["draft", "ready"] } },
      include: { participants: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.match.findMany({
      where: { sessionId },
      include: { participants: true, court: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sessionDto: SessionDto = {
    id: session.id,
    organizationId: session.organizationId,
    name: session.name,
    venueName: session.venueName,
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt?.toISOString() ?? null,
    status: session.status as SessionDto["status"],
    feeAmount: session.feeAmount,
    currency: session.currency,
    queueMode: session.queueMode as SessionDto["queueMode"],
    requirePaymentBeforePlay: session.requirePaymentBeforePlay,
    ratingMode: session.ratingMode as SessionDto["ratingMode"],
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };

  const checkInDtos: CheckInDto[] = checkIns.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    playerProfileId: row.playerProfileId,
    playerDisplayName: row.playerProfile.displayName,
    arrivalOrder: row.arrivalOrder,
    checkedInAt: row.checkedInAt.toISOString(),
    queueStatus: row.queueStatus as CheckInDto["queueStatus"],
    sessionSkillRating: row.sessionSkillRating,
    paymentStatus: row.paymentStatus as CheckInDto["paymentStatus"],
    paymentAmountDue: row.paymentAmountDue,
    paymentAmountPaid: row.paymentAmountPaid,
    paymentMethod: row.paymentMethod,
    paymentNotes: row.paymentNotes,
    suggestionExcluded: row.suggestionExcluded,
    suggestionExcludeNote: row.suggestionExcludeNote ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  const activeMatches = matches.filter((m) =>
    ["assigned", "in_progress"].includes(m.status),
  );
  const recentMatches = matches.filter((m) =>
    ["completed", "cancelled"].includes(m.status),
  );

  const paymentSummary = computePaymentSummary(
    checkIns.map((c) => ({
      id: c.id,
      paymentStatus: c.paymentStatus as CheckInDto["paymentStatus"],
      paymentAmountDue: c.paymentAmountDue,
      paymentAmountPaid: c.paymentAmountPaid,
    })),
    session.feeAmount,
    session.currency,
  );

  const now = new Date().toISOString();
  const suggestion =
    session.queueMode === "suggested"
      ? buildSuggestion({
          session: {
            id: session.id,
            status: session.status as "draft" | "open" | "active" | "completed" | "cancelled",
            queueMode: session.queueMode as "suggested" | "manual",
            ratingMode: session.ratingMode as "casual" | "rated",
          },
          checkIns: checkIns.map((c) => ({
            id: c.id,
            playerProfileId: c.playerProfileId,
            queueStatus: c.queueStatus as "waiting" | "assigned" | "playing" | "resting" | "done" | "removed",
            sessionSkillRating: c.sessionSkillRating,
            arrivalOrder: c.arrivalOrder,
            checkedInAt: c.checkedInAt.toISOString(),
            matchesPlayedInSession: c.matchesPlayedInSession,
            lastMatchEndedAt: c.lastMatchEndedAt?.toISOString() ?? null,
            suggestionExcluded: c.suggestionExcluded,
            paymentStatus: c.paymentStatus as CheckInDto["paymentStatus"],
            paymentAmountDue: c.paymentAmountDue,
            paymentAmountPaid: c.paymentAmountPaid,
          })),
          queuedMatches: queuedMatches.map((qm) => ({
            id: qm.id,
            laneId: qm.queueLaneId,
            status: qm.status as "draft" | "ready" | "promoted" | "removed",
            participants: qm.participants.map((p) => ({
              checkInId: p.checkInId,
              playerProfileId: p.playerProfileId,
            })),
          })),
          matches: matches.map((m) => ({
            id: m.id,
            courtId: m.courtId,
            status: m.status as "assigned" | "in_progress" | "completed" | "cancelled",
            outcome: m.outcome as "team_one_win" | "team_two_win" | "draw" | "unscored" | "cancelled" | null,
            winningTeam: m.winningTeam as "team_one" | "team_two" | null,
            startedAt: m.startedAt?.toISOString() ?? null,
            endedAt: m.endedAt?.toISOString() ?? null,
            completedAt: m.completedAt?.toISOString() ?? null,
            participants: m.participants.map((p) => ({
              checkInId: p.checkInId,
              playerProfileId: p.playerProfileId,
              team: p.team as "team_one" | "team_two",
            })),
          })),
          courts: courts.map((c) => ({
            id: c.id,
            status: c.status as "open" | "occupied" | "paused" | "unavailable",
            currentMatchId: c.currentMatchId,
          })),
          now,
        })
      : null;

  return {
    session: sessionDto,
    courts,
    checkIns: checkInDtos,
    queue: {
      lanes: queueLanes,
      queuedMatches,
      suggestion,
    },
    matches: { active: activeMatches, recent: recentMatches },
    payments: {
      summary: paymentSummary,
      exceptions: checkIns.filter((c) => c.paymentStatus === "unpaid" || c.paymentStatus === "partial"),
    },
    leaderboardPreview: [],
    sync: {
      lastSyncedAt: now,
      serverVersion: session.serverVersion,
    },
    serverVersion: session.serverVersion,
  };
}
