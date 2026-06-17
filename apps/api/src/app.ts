import Fastify from "fastify";
import cors from "@fastify/cors";
import { errorHandler } from "./http/errors.js";
import { registerHealthRoutes } from "./http/plugins/health.js";

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  await app.register(cors, {
    origin: true,
  });

  app.setErrorHandler(errorHandler);

  await registerHealthRoutes(app);

  return app;
}
