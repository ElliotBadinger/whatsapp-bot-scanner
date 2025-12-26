import fc from "fast-check";
import { sanitizeError } from "@wbscanner/shared";

describe("Error Sanitizer Properties", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("in production mode", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should NEVER expose arbitrary error messages", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 500 }), (message) => {
          const error = new Error(message);
          const sanitized = sanitizeError(error);

          // Should return generic message
          expect(sanitized.message).toBe("Internal server error");
          // Should not contain original message
          expect(sanitized.message).not.toContain(message);
        }),
        { numRuns: 200 },
      );
    });

    it("should NEVER expose stack traces", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (message) => {
          const error = new Error(message);
          const sanitized = sanitizeError(error);

          expect(sanitized).not.toHaveProperty("stack");
        }),
        { numRuns: 100 },
      );
    });

    it("should NEVER expose context data", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.dictionary(fc.string(), fc.string()),
          (message, context) => {
            const error = new Error(message);
            const sanitized = sanitizeError(error, context);

            expect(sanitized).not.toHaveProperty("context");
            // Verify no context values leaked into message
            for (const value of Object.values(context)) {
              if (value.length > 3) {
                expect(sanitized.message).not.toContain(value);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should ALWAYS return one of the known safe messages", () => {
      const safeMessages = [
        "Invalid request",
        "Authentication failed",
        "Too many requests",
        "Internal server error",
      ];

      fc.assert(
        fc.property(fc.anything(), (input) => {
          const sanitized = sanitizeError(input);
          expect(safeMessages).toContain(sanitized.message);
        }),
        { numRuns: 200 },
      );
    });

    it("should ALWAYS return a valid error code", () => {
      const validCodes = [
        "VALIDATION_ERROR",
        "AUTH_ERROR",
        "RATE_LIMIT",
        "INTERNAL_ERROR",
      ];

      fc.assert(
        fc.property(fc.anything(), (input) => {
          const sanitized = sanitizeError(input);
          expect(validCodes).toContain(sanitized.code);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe("sensitive data patterns", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should not leak SQL queries", () => {
      const sqlKeywords = [
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "CREATE",
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...sqlKeywords),
          fc.string(),
          fc.string(),
          (keyword, table, condition) => {
            const query = `${keyword} * FROM ${table} WHERE ${condition}`;
            const error = new Error(`Query failed: ${query}`);
            const sanitized = sanitizeError(error);

            expect(sanitized.message).not.toContain(keyword);
            expect(sanitized.message).not.toContain(table);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should not leak file paths", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("/home/", "/var/", "/etc/", "C:\\Users\\", "/root/"),
          fc.string({ minLength: 1, maxLength: 50 }),
          (prefix, path) => {
            const fullPath = `${prefix}${path}`;
            const error = new Error(`Cannot read file ${fullPath}`);
            const sanitized = sanitizeError(error);

            expect(sanitized.message).not.toContain(prefix);
            expect(sanitized.message).not.toContain(path);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should not leak connection strings", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("postgres://", "mysql://", "redis://", "mongodb://"),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (protocol, user, host) => {
            const connString = `${protocol}${user}:password@${host}:5432/db`;
            const error = new Error(`Connection failed: ${connString}`);
            const sanitized = sanitizeError(error);

            expect(sanitized.message).not.toContain(protocol);
            expect(sanitized.message).not.toContain(user);
            expect(sanitized.message).not.toContain("password");
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
