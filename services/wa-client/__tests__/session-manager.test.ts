import {
  SessionManager,
  SessionFingerprint,
} from "../src/session/sessionManager";
import { InMemoryRedis } from "@wbscanner/shared/src/testing/in-memory-redis";
import pino from "pino";

describe("SessionManager", () => {
  let redis: InMemoryRedis;
  let manager: SessionManager;
  let logger: pino.Logger;

  beforeEach(() => {
    redis = new InMemoryRedis();
    logger = pino({ level: "silent" });
    manager = new SessionManager(redis as any, logger);
  });

  const testFingerprint: SessionFingerprint = {
    userAgent: "whatsapp-web.js",
    ipAddress: "192.168.1.10",
    platform: "linux",
  };

  describe("recordSessionCreation", () => {
    it("should create a new session with fingerprint", async () => {
      const sessionId = "test-session-123";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const info = await manager.getSessionInfo(sessionId);
      expect(info).toBeDefined();
      expect(info?.sessionId).toBe(sessionId);
      expect(info?.fingerprint).toEqual(testFingerprint);
    });

    it("should set createdAt and lastActivity timestamps", async () => {
      const sessionId = "test-session-456";
      const before = Date.now();
      await manager.recordSessionCreation(sessionId, testFingerprint);
      const after = Date.now();

      const info = await manager.getSessionInfo(sessionId);
      expect(info?.createdAt).toBeGreaterThanOrEqual(before);
      expect(info?.createdAt).toBeLessThanOrEqual(after);
      expect(info?.lastActivity).toBeGreaterThanOrEqual(before);
    });
  });

  describe("validateSession", () => {
    it("should validate a valid session with matching fingerprint", async () => {
      const sessionId = "valid-session";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const isValid = await manager.validateSession(sessionId, testFingerprint);
      expect(isValid).toBe(true);
    });

    it("should reject session with different userAgent", async () => {
      const sessionId = "ua-mismatch-session";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const hijackedFingerprint: SessionFingerprint = {
        ...testFingerprint,
        userAgent: "different-agent",
      };

      const isValid = await manager.validateSession(
        sessionId,
        hijackedFingerprint,
      );
      expect(isValid).toBe(false);
    });

    it("should reject session with different platform", async () => {
      const sessionId = "platform-mismatch-session";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const hijackedFingerprint: SessionFingerprint = {
        ...testFingerprint,
        platform: "win32",
      };

      const isValid = await manager.validateSession(
        sessionId,
        hijackedFingerprint,
      );
      expect(isValid).toBe(false);
    });

    it("should allow IP changes within same /24 subnet", async () => {
      const sessionId = "subnet-session";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const sameSubnetFingerprint: SessionFingerprint = {
        ...testFingerprint,
        ipAddress: "192.168.1.20", // Same /24 subnet
      };

      const isValid = await manager.validateSession(
        sessionId,
        sameSubnetFingerprint,
      );
      expect(isValid).toBe(true);
    });

    it("should reject IP changes to different subnet", async () => {
      const sessionId = "different-subnet-session";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const differentSubnetFingerprint: SessionFingerprint = {
        ...testFingerprint,
        ipAddress: "10.0.0.5", // Different subnet
      };

      const isValid = await manager.validateSession(
        sessionId,
        differentSubnetFingerprint,
      );
      expect(isValid).toBe(false);
    });

    it("should reject non-existent session", async () => {
      const isValid = await manager.validateSession(
        "nonexistent",
        testFingerprint,
      );
      expect(isValid).toBe(false);
    });

    it("should update lastActivity on successful validation", async () => {
      const sessionId = "activity-session";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const infoBefore = await manager.getSessionInfo(sessionId);
      const originalActivity = infoBefore?.lastActivity;

      // Wait a bit to ensure timestamp changes
      await new Promise((r) => setTimeout(r, 10));

      await manager.validateSession(sessionId, testFingerprint);

      const infoAfter = await manager.getSessionInfo(sessionId);
      expect(infoAfter?.lastActivity).toBeGreaterThan(originalActivity!);
    });
  });

  describe("invalidateSession", () => {
    it("should remove session data", async () => {
      const sessionId = "to-invalidate";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      await manager.invalidateSession(sessionId);

      const info = await manager.getSessionInfo(sessionId);
      expect(info).toBeNull();
    });

    it("should make validation fail after invalidation", async () => {
      const sessionId = "invalidated-session";
      await manager.recordSessionCreation(sessionId, testFingerprint);
      await manager.invalidateSession(sessionId);

      const isValid = await manager.validateSession(sessionId, testFingerprint);
      expect(isValid).toBe(false);
    });
  });

  describe("rotateSession", () => {
    it("should create new session and invalidate old one", async () => {
      const oldSessionId = "old-session";
      await manager.recordSessionCreation(oldSessionId, testFingerprint);

      const newSessionId = await manager.rotateSession(
        oldSessionId,
        testFingerprint,
      );

      expect(newSessionId).not.toBe(oldSessionId);

      // Old session should be invalid
      const oldInfo = await manager.getSessionInfo(oldSessionId);
      expect(oldInfo).toBeNull();

      // New session should be valid
      const newInfo = await manager.getSessionInfo(newSessionId);
      expect(newInfo).toBeDefined();
      expect(newInfo?.fingerprint).toEqual(testFingerprint);
    });

    it("should generate unique session IDs", async () => {
      const oldSessionId = "rotate-test";
      await manager.recordSessionCreation(oldSessionId, testFingerprint);

      const newSessionId1 = await manager.rotateSession(
        oldSessionId,
        testFingerprint,
      );
      await manager.recordSessionCreation(oldSessionId, testFingerprint);
      const newSessionId2 = await manager.rotateSession(
        oldSessionId,
        testFingerprint,
      );

      expect(newSessionId1).not.toBe(newSessionId2);
    });
  });

  describe("shouldRotateSession", () => {
    it("should return false for new sessions", async () => {
      const sessionId = "new-session";
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const shouldRotate = await manager.shouldRotateSession(sessionId);
      expect(shouldRotate).toBe(false);
    });

    it("should return false for non-existent session", async () => {
      const shouldRotate = await manager.shouldRotateSession("nonexistent");
      expect(shouldRotate).toBe(false);
    });
  });

  describe("getSessionAge", () => {
    it("should return age of session in milliseconds", async () => {
      const sessionId = "age-test";
      const before = Date.now();
      await manager.recordSessionCreation(sessionId, testFingerprint);

      const age = await manager.getSessionAge(sessionId);
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(1000); // Should be less than 1 second
    });

    it("should return 0 for non-existent session", async () => {
      const age = await manager.getSessionAge("nonexistent");
      expect(age).toBe(0);
    });
  });

  describe("fingerprint matching edge cases", () => {
    it("should handle empty IP addresses", async () => {
      const sessionId = "empty-ip-session";
      const noIpFingerprint: SessionFingerprint = {
        ...testFingerprint,
        ipAddress: "",
      };
      await manager.recordSessionCreation(sessionId, noIpFingerprint);

      const isValid = await manager.validateSession(sessionId, noIpFingerprint);
      expect(isValid).toBe(true);
    });

    it("should handle IPv6 addresses gracefully", async () => {
      const sessionId = "ipv6-session";
      const ipv6Fingerprint: SessionFingerprint = {
        ...testFingerprint,
        ipAddress: "2001:db8::1",
      };
      await manager.recordSessionCreation(sessionId, ipv6Fingerprint);

      const isValid = await manager.validateSession(sessionId, ipv6Fingerprint);
      expect(isValid).toBe(true);
    });
  });
});
