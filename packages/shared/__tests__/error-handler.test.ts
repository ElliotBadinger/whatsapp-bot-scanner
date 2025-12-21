import Fastify, { FastifyInstance } from "fastify";
import { globalErrorHandler } from "../src/fastify/error-handler";
import {
  ValidationError,
  AuthenticationError,
  RateLimitError,
} from "../src/errors/sanitizer";

describe("Global Error Handler", () => {
  let app: FastifyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    app = Fastify({ logger: false });
    app.setErrorHandler(globalErrorHandler);
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app.close();
  });

  describe("in production mode", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should return 400 for ValidationError", async () => {
      app.get("/test", () => {
        throw new ValidationError({ field: "email" });
      });

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid request");
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body).not.toHaveProperty("details");
      expect(body).not.toHaveProperty("stack");
    });

    it("should return 401 for AuthenticationError", async () => {
      app.get("/test", () => {
        throw new AuthenticationError("Invalid token");
      });

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Authentication failed");
      expect(body.code).toBe("AUTH_ERROR");
    });

    it("should return 429 for RateLimitError", async () => {
      app.get("/test", () => {
        throw new RateLimitError(60);
      });

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Too many requests");
      expect(body.code).toBe("RATE_LIMIT");
    });

    it("should return 500 for unknown errors", async () => {
      app.get("/test", () => {
        throw new Error("Database connection failed");
      });

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Internal server error");
      expect(body.message).not.toContain("Database");
    });

    it("should not leak sensitive information", async () => {
      app.get("/test", () => {
        throw new Error("SELECT * FROM users WHERE password='secret123'");
      });

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      const body = JSON.parse(response.body);
      expect(body.message).not.toContain("SELECT");
      expect(body.message).not.toContain("password");
      expect(body.message).not.toContain("secret");
    });
  });

  describe("in development mode", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should expose full error details", async () => {
      app.get("/test", () => {
        throw new Error("Detailed error message");
      });

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Detailed error message");
      expect(body).toHaveProperty("stack");
    });
  });

  describe("HTTP status code handling", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should use statusCode from error if available", async () => {
      app.get("/test", () => {
        const err = new Error("Not found") as Error & { statusCode?: number };
        err.statusCode = 404;
        throw err;
      });

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(404);
    });

    it("should default to 500 for errors without statusCode", async () => {
      app.get("/test", () => {
        throw new Error("Unknown error");
      });

      const response = await app.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
