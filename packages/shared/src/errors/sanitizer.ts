import { ZodError } from "zod";
import { config } from "../config";

export class ValidationError extends Error {
  public readonly details?: unknown;
  public readonly code = "VALIDATION_ERROR";
  public readonly statusCode = 400;

  constructor(details?: unknown) {
    super("Validation failed");
    this.name = "ValidationError";
    this.details = details;
  }
}

export class AuthenticationError extends Error {
  public readonly code = "AUTH_ERROR";
  public readonly statusCode = 401;

  constructor(message = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends Error {
  public readonly retryAfter?: number;
  public readonly code = "RATE_LIMIT";
  public readonly statusCode = 429;

  constructor(retryAfter?: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export type SanitizedError = {
  message: string;
  code?: string;
  stack?: string;
  context?: Record<string, unknown>;
};

function isProduction(): boolean {
  return config.nodeEnv === "production";
}

export function sanitizeError(
  error: unknown,
  context: Record<string, unknown> = {},
): SanitizedError {
  if (!isProduction()) {
    return {
      message: error instanceof Error ? error.message : String(error),
      code: (error as { code?: string })?.code,
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };
  }

  if (error instanceof ValidationError || error instanceof ZodError) {
    return { message: "Invalid request", code: "VALIDATION_ERROR" };
  }

  if (error instanceof AuthenticationError) {
    return { message: "Authentication failed", code: "AUTH_ERROR" };
  }

  if (error instanceof RateLimitError) {
    return { message: "Too many requests", code: "RATE_LIMIT" };
  }

  return { message: "Internal server error", code: "INTERNAL_ERROR" };
}
