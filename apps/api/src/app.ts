import Fastify from "fastify";
import cors from "@fastify/cors";
import { errorHandler } from "./http/errors.js";
import { registerHealthRoutes } from "./http/plugins/health.js";
import { registerApiRoutes } from "./http/plugins/api-routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  await app.register(cors, {
    origin: true,
  });

  app.setErrorHandler(errorHandler);

  await registerHealthRoutes(app);
  await registerApiRoutes(app);

  return app;
}
