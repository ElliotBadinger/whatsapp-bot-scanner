import {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { logger } from "../log";
import {
  sanitizeError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
} from "../errors/sanitizer";

function resolveStatusCode(error: FastifyError | Error): number {
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  if (typeof statusCode === "number") {
    return statusCode;
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
  const statusCode = resolveStatusCode(error);
  const sanitized = sanitizeError(error, {
    url: request.url,
    method: request.method,
    requestId: request.id,
  });

  if (statusCode >= 500) {
    logger.error(
      {
        error,
        url: request.url,
        method: request.method,
        requestId: request.id,
      },
      "Unhandled error in request",
    );
  } else {
    logger.warn(
      {
        statusCode,
        error: sanitized,
        url: request.url,
        method: request.method,
        requestId: request.id,
      },
      "Request failed",
    );
  }

  if (
    error instanceof RateLimitError &&
    typeof error.retryAfter === "number" &&
    Number.isFinite(error.retryAfter)
  ) {
    reply.header("Retry-After", String(error.retryAfter));
  }

  reply.code(statusCode).send(sanitized);
}
