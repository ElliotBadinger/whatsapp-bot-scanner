import { AuditLogger, createAuditLogger } from "../src/audit-logger";

describe("AuditLogger", () => {
  let mockDbClient: {
    query: jest.Mock;
  };
  let auditLogger: AuditLogger;

  beforeEach(() => {
    mockDbClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    auditLogger = createAuditLogger({ dbClient: mockDbClient });
  });

  describe("log", () => {
    it("should persist audit entry to database", async () => {
      await auditLogger.log({
        actor: "user@example.com",
        action: "test_action",
        target: "test_target",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO audit_logs"),
        expect.arrayContaining(["user@example.com", "test_action", "test_target"]),
      );
    });

    it("should include metadata as JSON", async () => {
      await auditLogger.log({
        actor: "admin",
        action: "config_change",
        metadata: { oldValue: 1, newValue: 2 },
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringContaining('"oldValue":1'),
        ]),
      );
    });

    it("should handle null target", async () => {
      await auditLogger.log({
        actor: "system",
        action: "startup",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["system", "startup", null]),
      );
    });

    it("should not log when disabled", async () => {
      const disabledLogger = createAuditLogger({
        dbClient: mockDbClient,
        enabled: false,
      });

      await disabledLogger.log({
        actor: "test",
        action: "test",
      });

      expect(mockDbClient.query).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error("DB error"));

      await expect(
        auditLogger.log({
          actor: "test",
          action: "test",
        }),
      ).resolves.not.toThrow();
    });
  });

  describe("logSessionEvent", () => {
    it("should log session creation", async () => {
      await auditLogger.logSessionEvent("session-123", "created", {
        ip: "192.168.1.1",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["system", "session:created", "session-123"]),
      );
    });

    it("should log session invalidation", async () => {
      await auditLogger.logSessionEvent("session-456", "invalidated", {
        reason: "manual",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["session:invalidated"]),
      );
    });
  });

  describe("logAuthEvent", () => {
    it("should log login events", async () => {
      await auditLogger.logAuthEvent("user@example.com", "login", {
        method: "token",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["user@example.com", "auth:login"]),
      );
    });

    it("should log failed auth attempts", async () => {
      await auditLogger.logAuthEvent("attacker", "failed", {
        ip: "10.0.0.1",
        reason: "invalid_token",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["auth:failed"]),
      );
    });
  });

  describe("logAdminAction", () => {
    it("should log admin actions", async () => {
      await auditLogger.logAdminAction("admin@example.com", "mute_group", "group-123", {
        duration: "1h",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["admin@example.com", "admin:mute_group", "group-123"]),
      );
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security events with severity", async () => {
      await auditLogger.logSecurityEvent("fingerprint_mismatch", "critical", {
        sessionId: "session-789",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringContaining('"severity":"critical"'),
        ]),
      );
    });
  });

  describe("logOverrideChange", () => {
    it("should log override creation", async () => {
      await auditLogger.logOverrideChange("admin", "create", "url-hash-123", {
        status: "deny",
        scope: "global",
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["admin", "override:create", "url-hash-123"]),
      );
    });
  });

  describe("logScanEvent", () => {
    it("should log scan events", async () => {
      await auditLogger.logScanEvent("url-hash-456", "completed", {
        verdict: "malicious",
        score: 15,
      });

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["system", "scan:completed", "url-hash-456"]),
      );
    });
  });
});
