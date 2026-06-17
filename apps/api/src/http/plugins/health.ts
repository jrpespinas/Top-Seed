import type { FastifyInstance } from "fastify";
import { healthResponseSchema } from "@top-seed/contracts";
import { buildMeta } from "../errors.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/api/v1/health", async (_request, reply) => {
    const payload = {
      data: { status: "ok" as const },
      meta: buildMeta(),
    };

    const parsed = healthResponseSchema.parse(payload);
    return reply.send(parsed);
  });
}
