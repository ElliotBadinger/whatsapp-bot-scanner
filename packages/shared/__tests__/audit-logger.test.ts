import { AuditLogger, createAuditLogger } from "../src/audit-logger";
import { logger } from "../src/log";

describe("AuditLogger", () => {
  let persistMock: jest.Mock;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    persistMock = jest.fn().mockResolvedValue(undefined);
    auditLogger = createAuditLogger({ persist: persistMock });
  });

  describe("log", () => {
    it("should persist audit entry to database", async () => {
      await auditLogger.log({
        actor: "user@example.com",
        action: "test_action",
        target: "test_target",
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "user@example.com",
          action: "test_action",
          target: "test_target",
          timestamp: expect.any(Date),
        }),
      );
    });

    it("should include metadata as JSON", async () => {
      await auditLogger.log({
        actor: "admin",
        action: "config_change",
        metadata: { oldValue: 1, newValue: 2 },
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadataJson: expect.stringContaining('"oldValue":1'),
        }),
      );
    });

    it("should handle null target", async () => {
      await auditLogger.log({
        actor: "system",
        action: "startup",
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "system",
          action: "startup",
          target: null,
        }),
      );
    });

    it("should not persist when disabled", async () => {
      const infoSpy = jest
        .spyOn(logger, "info")
        .mockImplementation(() => undefined as never);
      const disabledLogger = createAuditLogger({
        persist: persistMock,
        enabled: false,
      });

      await disabledLogger.log({
        actor: "test",
        action: "test",
      });

      expect(infoSpy).toHaveBeenCalled();
      expect(persistMock).not.toHaveBeenCalled();
      infoSpy.mockRestore();
    });

    it("should handle database errors gracefully", async () => {
      persistMock.mockRejectedValueOnce(new Error("DB error"));

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

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "system",
          action: "session:created",
          target: "session-123",
        }),
      );
    });

    it("should log session invalidation", async () => {
      await auditLogger.logSessionEvent("session-456", "invalidated", {
        reason: "manual",
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "session:invalidated",
        }),
      );
    });
  });

  describe("logAuthEvent", () => {
    it("should log login events", async () => {
      await auditLogger.logAuthEvent("user@example.com", "login", {
        method: "token",
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "user@example.com",
          action: "auth:login",
        }),
      );
    });

    it("should log failed auth attempts", async () => {
      await auditLogger.logAuthEvent("attacker", "failed", {
        ip: "10.0.0.1",
        reason: "invalid_token",
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "auth:failed",
        }),
      );
    });
  });

  describe("logAdminAction", () => {
    it("should log admin actions", async () => {
      await auditLogger.logAdminAction(
        "admin@example.com",
        "mute_group",
        "group-123",
        {
          duration: "1h",
        },
      );

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "admin@example.com",
          action: "admin:mute_group",
          target: "group-123",
        }),
      );
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security events with severity", async () => {
      await auditLogger.logSecurityEvent("fingerprint_mismatch", "critical", {
        sessionId: "session-789",
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadataJson: expect.stringContaining('"severity":"critical"'),
        }),
      );
    });
  });

  describe("logOverrideChange", () => {
    it("should log override creation", async () => {
      await auditLogger.logOverrideChange("admin", "create", "url-hash-123", {
        status: "deny",
        scope: "global",
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "admin",
          action: "override:create",
          target: "url-hash-123",
        }),
      );
    });
  });

  describe("logScanEvent", () => {
    it("should log scan events", async () => {
      await auditLogger.logScanEvent("url-hash-456", "completed", {
        verdict: "malicious",
        score: 15,
      });

      expect(persistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "system",
          action: "scan:completed",
          target: "url-hash-456",
        }),
      );
    });
  });
});
