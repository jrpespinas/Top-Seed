import type { FastifyInstance } from "fastify";
import { syncActionsRequestSchema } from "@top-seed/contracts";
import { z } from "zod";
import { checkInPlayer } from "../../modules/check-ins/check-in-player.js";
import { createSession, startSession } from "../../modules/sessions/create-session.js";
import { getSessionDashboard } from "../../modules/sessions/get-dashboard.js";
import { createQueuedMatch, promoteQueuedMatchToCourt } from "../../modules/queue/queued-match.js";
import { startMatch, completeMatch } from "../../modules/matches/match-lifecycle.js";
import { processSyncActions } from "../../modules/sync/process-sync-actions.js";
import { buildMeta } from "../../shared/http/meta.js";

const createSessionBodySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  venueName: z.string(),
  startsAt: z.string().datetime(),
  feeAmount: z.number().int().nonnegative(),
  currency: z.string().optional(),
  queueMode: z.enum(["suggested", "manual"]).optional(),
  ratingMode: z.enum(["casual", "rated"]).optional(),
  courtCount: z.number().int().positive().optional(),
});

const checkInBodySchema = z.object({
  id: z.string(),
  playerProfileId: z.string(),
  arrivalOrder: z.number().int().nonnegative(),
  checkedInAt: z.string().datetime(),
  sessionSkillRating: z.number(),
  paymentAmountDue: z.number().int().nonnegative().optional(),
});

export async function registerApiRoutes(app: FastifyInstance) {
  app.post("/api/v1/sessions", async (request, reply) => {
    const body = createSessionBodySchema.parse(request.body);
    const session = await createSession(body);
    return reply.send({ data: session, meta: buildMeta() });
  });

  app.post("/api/v1/sessions/:sessionId/start", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = await startSession(sessionId);
    return reply.send({ data: session, meta: buildMeta() });
  });

  app.get("/api/v1/sessions/:sessionId/dashboard", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const dashboard = await getSessionDashboard(sessionId);
    return reply.send({
      data: dashboard,
      meta: buildMeta(dashboard.serverVersion),
    });
  });

  app.post("/api/v1/sessions/:sessionId/check-ins", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = checkInBodySchema.parse(request.body);
    const result = await checkInPlayer({ ...body, sessionId });
    return reply.send({
      data: result.checkIn,
      meta: buildMeta(result.serverVersion),
    });
  });

  app.post("/api/v1/sessions/:sessionId/queue/lanes/:laneId/queued-matches", async (request, reply) => {
    const { sessionId, laneId } = request.params as { sessionId: string; laneId: string };
    const body = z
      .object({
        id: z.string(),
        sortOrder: z.number().int().nonnegative(),
        createdFrom: z.enum(["manual", "suggestion"]),
        participants: z.array(
          z.object({
            playerProfileId: z.string(),
            checkInId: z.string(),
            team: z.enum(["team_one", "team_two"]),
            slotOrder: z.union([z.literal(1), z.literal(2)]),
          }),
        ),
      })
      .parse(request.body);
    const result = await createQueuedMatch({
      id: body.id,
      sessionId,
      queueLaneId: laneId,
      sortOrder: body.sortOrder,
      createdFrom: body.createdFrom,
      participants: body.participants,
    });
    return reply.send({
      data: result.queuedMatch,
      meta: buildMeta(result.serverVersion),
    });
  });

  app.post(
    "/api/v1/sessions/:sessionId/queue/queued-matches/:queuedMatchId/move-to-court",
    async (request, reply) => {
      const { sessionId, queuedMatchId } = request.params as {
        sessionId: string;
        queuedMatchId: string;
      };
      const body = z
        .object({
          courtId: z.string(),
          matchId: z.string(),
          assignedAt: z.string().datetime(),
        })
        .parse(request.body);
      const result = await promoteQueuedMatchToCourt({
        queuedMatchId,
        sessionId,
        courtId: body.courtId,
        matchId: body.matchId,
        assignedAt: body.assignedAt,
      });
      return reply.send({
        data: result.match,
        meta: buildMeta(result.serverVersion),
      });
    },
  );

  app.post("/api/v1/sessions/:sessionId/matches/:matchId/start", async (request, reply) => {
    const { sessionId, matchId } = request.params as { sessionId: string; matchId: string };
    const body = z.object({ startedAt: z.string().datetime() }).parse(request.body);
    const result = await startMatch({ sessionId, matchId, startedAt: body.startedAt });
    return reply.send({ data: { id: matchId, status: "in_progress" }, meta: buildMeta(result.serverVersion) });
  });

  app.post("/api/v1/sessions/:sessionId/matches/:matchId/complete", async (request, reply) => {
    const { sessionId, matchId } = request.params as { sessionId: string; matchId: string };
    const body = z
      .object({
        outcome: z.enum(["team_one_win", "team_two_win", "draw", "unscored"]),
        teamOneScore: z.number().int().nonnegative().optional(),
        teamTwoScore: z.number().int().nonnegative().optional(),
        winningTeam: z.enum(["team_one", "team_two"]).optional().nullable(),
        endedAt: z.string().datetime().optional(),
      })
      .parse(request.body);
    const result = await completeMatch({ sessionId, matchId, result: body });
    return reply.send({
      data: { id: matchId, status: "completed", outcome: body.outcome },
      meta: buildMeta(result.serverVersion),
    });
  });

  app.post("/api/v1/sync/actions", async (request, reply) => {
    const body = syncActionsRequestSchema.parse(request.body);
    const response = await processSyncActions(body);
    return reply.send(response);
  });

  app.get("/api/v1/sync/status", async (_request, reply) => {
    return reply.send({
      organizationId: "org-default",
      deviceId: "local",
      lastSyncedAt: null,
      serverTime: new Date().toISOString(),
      pendingCount: 0,
      failedCount: 0,
      failedActions: [],
    });
  });
}
