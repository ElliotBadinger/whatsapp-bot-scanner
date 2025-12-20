import {
  sanitizeError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
} from "../errors/sanitizer";

describe("sanitizeError", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("sanitizes validation errors in production", () => {
    process.env.NODE_ENV = "production";
    const sanitized = sanitizeError(new ValidationError({ field: "email" }));

    expect(sanitized.message).toBe("Invalid request");
    expect(sanitized.code).toBe("VALIDATION_ERROR");
    expect((sanitized as Record<string, unknown>).details).toBeUndefined();
    expect(sanitized.stack).toBeUndefined();
  });

  it("exposes stack and context outside production", () => {
    process.env.NODE_ENV = "development";
    const sanitized = sanitizeError(new ValidationError({ field: "email" }), {
      endpoint: "/overrides",
    });

    expect(sanitized.message).toBe("Validation failed");
    expect(sanitized.stack).toBeDefined();
    expect(sanitized.context).toEqual({ endpoint: "/overrides" });
  });

  it("returns generic messaging for unknown production errors", () => {
    process.env.NODE_ENV = "production";
    const sanitized = sanitizeError(new Error("Database connection failed"));

    expect(sanitized.message).toBe("Internal server error");
    expect(sanitized.code).toBe("INTERNAL_ERROR");
  });

  it("preserves custom error codes", () => {
    process.env.NODE_ENV = "production";
    const sanitized = sanitizeError(new AuthenticationError());
    expect(sanitized.code).toBe("AUTH_ERROR");
  });

  it("handles rate limit errors", () => {
    process.env.NODE_ENV = "production";
    const sanitized = sanitizeError(new RateLimitError());
    expect(sanitized.code).toBe("RATE_LIMIT");
    expect(sanitized.message).toBe("Too many requests");
  });
});
