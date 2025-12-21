import {
  sanitizeError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
} from "../src/errors/sanitizer";
import { ZodError, z } from "zod";

describe("Error Sanitizer", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("in production mode", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should sanitize validation errors", () => {
      const error = new ValidationError({ field: "email", message: "invalid format" });
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toBe("Invalid request");
      expect(sanitized.code).toBe("VALIDATION_ERROR");
      expect(sanitized).not.toHaveProperty("details");
      expect(sanitized).not.toHaveProperty("stack");
    });

    it("should sanitize ZodError", () => {
      const schema = z.object({ email: z.string().email() });
      let zodError: ZodError | undefined;
      try {
        schema.parse({ email: "invalid" });
      } catch (e) {
        zodError = e as ZodError;
      }

      const sanitized = sanitizeError(zodError!);
      expect(sanitized.message).toBe("Invalid request");
      expect(sanitized.code).toBe("VALIDATION_ERROR");
      expect(JSON.stringify(sanitized)).not.toContain("email");
    });

    it("should sanitize authentication errors", () => {
      const error = new AuthenticationError("Token expired at 2024-01-01");
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toBe("Authentication failed");
      expect(sanitized.code).toBe("AUTH_ERROR");
      expect(sanitized.message).not.toContain("Token");
      expect(sanitized.message).not.toContain("2024");
    });

    it("should sanitize rate limit errors", () => {
      const error = new RateLimitError(60);
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toBe("Too many requests");
      expect(sanitized.code).toBe("RATE_LIMIT");
      expect(sanitized).not.toHaveProperty("retryAfter");
    });

    it("should sanitize unknown errors to generic message", () => {
      const error = new Error("Database connection failed to postgres://user:pass@host:5432/db");
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toBe("Internal server error");
      expect(sanitized.code).toBe("INTERNAL_ERROR");
      expect(sanitized.message).not.toContain("Database");
      expect(sanitized.message).not.toContain("postgres");
      expect(sanitized.message).not.toContain("pass");
    });

    it("should not expose stack traces in production", () => {
      const error = new Error("Sensitive error");
      const sanitized = sanitizeError(error);

      expect(sanitized).not.toHaveProperty("stack");
    });

    it("should not expose context in production", () => {
      const error = new Error("Internal error");
      const sanitized = sanitizeError(error, {
        userId: "user123",
        action: "deleteAccount",
        sensitiveData: "secret",
      });

      expect(sanitized).not.toHaveProperty("context");
      expect(JSON.stringify(sanitized)).not.toContain("user123");
      expect(JSON.stringify(sanitized)).not.toContain("secret");
    });

    it("should handle non-Error objects", () => {
      const sanitized1 = sanitizeError("string error");
      expect(sanitized1.message).toBe("Internal server error");

      const sanitized2 = sanitizeError({ custom: "error" });
      expect(sanitized2.message).toBe("Internal server error");

      const sanitized3 = sanitizeError(null);
      expect(sanitized3.message).toBe("Internal server error");

      const sanitized4 = sanitizeError(undefined);
      expect(sanitized4.message).toBe("Internal server error");
    });

    it("should handle errors with sensitive SQL queries", () => {
      const error = new Error(
        "Query failed: SELECT * FROM users WHERE password = 'secret123'"
      );
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toBe("Internal server error");
      expect(sanitized.message).not.toContain("SELECT");
      expect(sanitized.message).not.toContain("password");
      expect(sanitized.message).not.toContain("secret123");
    });

    it("should handle errors with file paths", () => {
      const error = new Error(
        "Cannot read file /home/user/.secrets/api_key.txt"
      );
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toBe("Internal server error");
      expect(sanitized.message).not.toContain("/home");
      expect(sanitized.message).not.toContain("secrets");
    });
  });

  describe("in development mode", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should expose full error details", () => {
      const error = new Error("Detailed error message");
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toBe("Detailed error message");
      expect(sanitized).toHaveProperty("stack");
    });

    it("should expose context in development", () => {
      const error = new Error("Error");
      const sanitized = sanitizeError(error, { debug: "info" });

      expect(sanitized.context).toEqual({ debug: "info" });
    });

    it("should expose error code in development", () => {
      const error = new ValidationError({ field: "test" });
      const sanitized = sanitizeError(error);

      expect(sanitized.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("in test mode", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "test";
    });

    it("should expose full error details like development", () => {
      const error = new Error("Test error");
      const sanitized = sanitizeError(error);

      expect(sanitized.message).toBe("Test error");
      expect(sanitized).toHaveProperty("stack");
    });
  });
});

describe("Custom Error Classes", () => {
  describe("ValidationError", () => {
    it("should have correct properties", () => {
      const error = new ValidationError({ fields: ["email"] });

      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("Validation failed");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ fields: ["email"] });
    });
  });

  describe("AuthenticationError", () => {
    it("should have correct properties", () => {
      const error = new AuthenticationError();

      expect(error.name).toBe("AuthenticationError");
      expect(error.message).toBe("Authentication failed");
      expect(error.code).toBe("AUTH_ERROR");
      expect(error.statusCode).toBe(401);
    });

    it("should accept custom message", () => {
      const error = new AuthenticationError("Token expired");

      expect(error.message).toBe("Token expired");
    });
  });

  describe("RateLimitError", () => {
    it("should have correct properties", () => {
      const error = new RateLimitError(30);

      expect(error.name).toBe("RateLimitError");
      expect(error.message).toBe("Rate limit exceeded");
      expect(error.code).toBe("RATE_LIMIT");
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(30);
    });

    it("should work without retryAfter", () => {
      const error = new RateLimitError();

      expect(error.retryAfter).toBeUndefined();
    });
  });
});
