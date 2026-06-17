import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { ApiError } from "@top-seed/contracts";
import { UseCaseError } from "../shared/application/errors.js";
import { buildMeta } from "../shared/http/meta.js";

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

function statusForCode(code: string): number {
  if (code === "VALIDATION_ERROR" || code === "SYNC_PAYLOAD_INVALID") {
    return 400;
  }
  if (
    code.startsWith("SESSION_") ||
    code.startsWith("COURT_") ||
    code.startsWith("MATCH_") ||
    code.startsWith("QUEUE_") ||
    code.startsWith("QUEUED_") ||
    code.startsWith("PLAYER_") ||
    code.startsWith("PAYMENT_") ||
    code.startsWith("INVALID_")
  ) {
    return 409;
  }
  return 500;
}

export function errorHandler(
  error: FastifyError | UseCaseError | ZodError,
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

  if (error instanceof UseCaseError) {
    return sendError(reply, statusForCode(error.code), {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error.statusCode && error.statusCode < 500) {
    return sendError(reply, error.statusCode, {
      code: error.code ?? "REQUEST_ERROR",
      message: error.message,
    });
  }

  return sendError(reply, 500, {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
  });
}
