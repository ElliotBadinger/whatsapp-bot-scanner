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
  const context = {
    url: request.url,
    method: request.method,
    requestId: request.id,
  };

  const statusCode = resolveStatusCode(error);
  const sanitized = sanitizeError(error, context);

  const log = statusCode >= 500 ? logger.error : logger.warn;

  log({ error, ...context, statusCode }, "Request failed");
  reply.code(statusCode).send(sanitized);
}
