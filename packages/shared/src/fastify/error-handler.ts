import { type FastifyError, type FastifyReply, type FastifyRequest } from "fastify";
import { logger } from "../log";
import {
  sanitizeError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
} from "../errors/sanitizer";

function resolveStatusCode(error: FastifyError): number {
  if (typeof error.statusCode === "number") {
    return error.statusCode;
  }

  if (error instanceof ValidationError) return 400;
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof RateLimitError) return 429;

  return 500;
}

export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const sanitized = sanitizeError(error, {
    url: request.url,
    method: request.method,
    requestId: request.id,
  });

  logger.error(
    {
      error,
      url: request.url,
      method: request.method,
      requestId: request.id,
    },
    "Unhandled error in request",
  );

  const statusCode = resolveStatusCode(error);
  reply.code(statusCode).send(sanitized);
}
