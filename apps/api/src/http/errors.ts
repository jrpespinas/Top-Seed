import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { ApiError, ResponseMeta } from "@top-seed/contracts";

export function buildMeta(serverVersion?: number): ResponseMeta {
  return {
    serverTime: new Date().toISOString(),
    ...(serverVersion !== undefined ? { serverVersion } : {}),
  };
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  error: ApiError,
  serverVersion?: number,
) {
  return reply.status(statusCode).send({
    error,
    meta: buildMeta(serverVersion),
  });
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  if (error instanceof ZodError) {
    return sendError(reply, 400, {
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: { issues: error.issues },
    });
  }

  if (error.statusCode && error.statusCode < 500) {
    return sendError(reply, error.statusCode, {
      code: error.code ?? "REQUEST_ERROR",
      message: error.message,
    });
  }

  return sendError(reply, 500, {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
}
