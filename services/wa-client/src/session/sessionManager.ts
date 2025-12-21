import type { Logger } from "pino";
import type { Redis } from "ioredis";
import crypto from "node:crypto";
import { config } from "@wbscanner/shared";
import { forceRemoteSessionReset } from "./cleanup.js";
import { createRemoteAuthStore } from "../remoteAuthStore.js";
import { loadEncryptionMaterials } from "../crypto/dataKeyProvider.js";

export interface SessionFingerprint {
  userAgent: string;
  ipAddress: string;
  platform: string;
}

export interface SessionInfo {
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  fingerprint: SessionFingerprint;
  version: string;
}

const SESSION_KEY_PREFIX = "wa:session:meta:";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_ROTATION_AGE_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (rotate before expiry)

export class SessionManager {
  private static warnedUnkeyedDigest = false;

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  private sessionKey(sessionId: string): string {
    return `${SESSION_KEY_PREFIX}${sessionId}`;
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async recordSessionCreation(
    sessionId: string,
    fingerprint: SessionFingerprint,
  ): Promise<void> {
    const key = this.sessionKey(sessionId);
    const now = Date.now();

    await this.redis.hset(key, {
      createdAt: String(now),
      lastActivity: String(now),
      fingerprint: JSON.stringify(fingerprint),
      version: "1",
    });

    const ttlSeconds = Math.ceil(SESSION_MAX_AGE_MS / 1000);
    await this.redis.expire(key, ttlSeconds);

    this.logger.info({ sessionId }, "Session created");
  }

  async validateSession(
    sessionId: string,
    currentFingerprint: SessionFingerprint,
  ): Promise<boolean> {
    const key = this.sessionKey(sessionId);
    const stored = await this.redis.hgetall(key);

    if (!stored.createdAt) {
      this.logger.warn({ sessionId }, "Session not found");
      return false;
    }

    const createdAt = Number.parseInt(stored.createdAt, 10);
    const age = Date.now() - createdAt;

    if (age > SESSION_MAX_AGE_MS) {
      this.logger.warn({ sessionId, ageMs: age }, "Session expired");
      await this.invalidateSession(sessionId);
      return false;
    }

    const storedFingerprint = this.normalizeFingerprint(
      JSON.parse(stored.fingerprint || "{}") as Partial<SessionFingerprint>,
    );

    const normalizedCurrentFingerprint =
      this.normalizeFingerprint(currentFingerprint);

    if (
      !this.fingerprintsMatch(storedFingerprint, normalizedCurrentFingerprint)
    ) {
      this.logger.warn(
        {
          sessionId,
          mismatch: this.getFingerprintMismatch(
            storedFingerprint,
            normalizedCurrentFingerprint,
          ),
          stored: this.summarizeFingerprintForLog(storedFingerprint),
          current: this.summarizeFingerprintForLog(
            normalizedCurrentFingerprint,
          ),
        },
        "Session fingerprint mismatch - possible hijack",
      );
      await this.invalidateSession(sessionId);
      return false;
    }

    await this.redis.hset(key, "lastActivity", String(Date.now()));
    return true;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const key = this.sessionKey(sessionId);
    await this.redis.del(key);
    this.logger.info({ sessionId }, "Session invalidated");
  }

  async rotateSession(
    oldSessionId: string,
    fingerprint: SessionFingerprint,
  ): Promise<string> {
    const newSessionId = this.generateSessionId();

    await this.recordSessionCreation(newSessionId, fingerprint);
    await this.invalidateSession(oldSessionId);

    this.logger.info({ oldSessionId, newSessionId }, "Session rotated");
    return newSessionId;
  }

  async shouldRotateSession(sessionId: string): Promise<boolean> {
    const key = this.sessionKey(sessionId);
    const createdAtStr = await this.redis.hget(key, "createdAt");

    if (!createdAtStr) {
      return false;
    }

    const createdAt = Number.parseInt(createdAtStr, 10);
    const age = Date.now() - createdAt;

    return age > SESSION_ROTATION_AGE_MS;
  }

  async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    const key = this.sessionKey(sessionId);
    const stored = await this.redis.hgetall(key);

    if (!stored.createdAt) {
      return null;
    }

    return {
      sessionId,
      createdAt: Number.parseInt(stored.createdAt, 10),
      lastActivity: Number.parseInt(stored.lastActivity, 10),
      fingerprint: JSON.parse(stored.fingerprint || "{}"),
      version: stored.version || "1",
    };
  }

  async getSessionAge(sessionId: string): Promise<number> {
    const info = await this.getSessionInfo(sessionId);
    if (!info) {
      return 0;
    }
    return Date.now() - info.createdAt;
  }

  private fingerprintsMatch(
    stored: SessionFingerprint,
    current: SessionFingerprint,
  ): boolean {
    if (stored.userAgent !== current.userAgent) {
      return false;
    }

    if (stored.platform !== current.platform) {
      return false;
    }

    if (!this.ipInSameSubnet(stored.ipAddress, current.ipAddress)) {
      return false;
    }

    return true;
  }

  private normalizeFingerprint(
    fingerprint: Partial<SessionFingerprint>,
  ): SessionFingerprint {
    return {
      userAgent: fingerprint.userAgent ?? "",
      ipAddress: fingerprint.ipAddress ?? "",
      platform: fingerprint.platform ?? "",
    };
  }

  private getFingerprintMismatch(
    stored: SessionFingerprint,
    current: SessionFingerprint,
  ): {
    userAgent: boolean;
    ipSubnet: boolean;
    platform: boolean;
  } {
    return {
      userAgent: stored.userAgent !== current.userAgent,
      platform: stored.platform !== current.platform,
      ipSubnet: !this.ipInSameSubnet(stored.ipAddress, current.ipAddress),
    };
  }

  private summarizeFingerprintForLog(fingerprint: SessionFingerprint): {
    userAgentHash: string | null;
    ipHash: string | null;
    ipSubnet: string | null;
    ipKind: "missing" | "ipv4" | "ipv6" | "unknown";
    platform: string;
  } {
    return {
      userAgentHash: this.digestSensitiveValue("ua", fingerprint.userAgent),
      ipHash: this.digestSensitiveValue("ip", fingerprint.ipAddress),
      ipSubnet: this.subnet24(fingerprint.ipAddress),
      ipKind: this.ipKind(fingerprint.ipAddress),
      platform: fingerprint.platform,
    };
  }

  private digestSensitiveValue(label: string, value: string): string | null {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const secret = process.env.IDENTIFIER_HASH_SECRET;

    if (
      !secret &&
      !SessionManager.warnedUnkeyedDigest &&
      process.env.NODE_ENV !== "test"
    ) {
      SessionManager.warnedUnkeyedDigest = true;
      this.logger.warn(
        "IDENTIFIER_HASH_SECRET not set; using unkeyed hashing for session fingerprint logs",
      );
    }

    const digest = secret
      ? crypto
          .createHmac("sha256", secret)
          .update(`${label}:${normalized}`)
          .digest("hex")
      : crypto
          .createHash("sha256")
          .update(`${label}:${normalized}`)
          .digest("hex");

    return digest.slice(0, 16);
  }

  private subnet24(ip: string): string | null {
    const normalized = ip.trim();
    if (!normalized) {
      return null;
    }

    const parts = normalized.split(".");
    if (parts.length !== 4) {
      return null;
    }

    const parsed = parts.map((part) => Number.parseInt(part, 10));
    if (
      parsed.some(
        (value) => !Number.isFinite(value) || value < 0 || value > 255,
      )
    ) {
      return null;
    }

    return `${parsed[0]}.${parsed[1]}.${parsed[2]}.x`;
  }

  private ipKind(ip: string): "missing" | "ipv4" | "ipv6" | "unknown" {
    const normalized = ip.trim();
    if (!normalized) {
      return "missing";
    }

    if (normalized.includes(":")) {
      return "ipv6";
    }

    const parts = normalized.split(".");
    if (parts.length === 4) {
      return "ipv4";
    }

    return "unknown";
  }

  private ipInSameSubnet(ip1: string, ip2: string): boolean {
    if (!ip1 || !ip2) {
      return true;
    }

    const parts1 = ip1.split(".");
    const parts2 = ip2.split(".");

    if (parts1.length !== 4 || parts2.length !== 4) {
      return true;
    }

    return (
      parts1[0] === parts2[0] &&
      parts1[1] === parts2[1] &&
      parts1[2] === parts2[2]
    );
  }

  async clearSession(reason: string): Promise<void> {
    if (config.wa.authStrategy !== "remote") {
      this.logger.info("Skipping session clear (not using RemoteAuth)");
      return;
    }

    this.logger.warn(
      { reason },
      "Clearing invalid RemoteAuth session to trigger re-pairing",
    );

    try {
      const materials = await loadEncryptionMaterials(
        config.wa.remoteAuth,
        this.logger,
      );
      const store = createRemoteAuthStore({
        redis: this.redis,
        logger: this.logger,
        prefix: `remoteauth:v1:${config.wa.remoteAuth.clientId}`,
        materials,
        clientId: config.wa.remoteAuth.clientId,
      });

      const sessionName = config.wa.remoteAuth.clientId
        ? `RemoteAuth-${config.wa.remoteAuth.clientId}`
        : "RemoteAuth";

      await forceRemoteSessionReset({
        deleteRemoteSession: (session: string) => store.delete({ session }),
        clearAckWatchers: () => {}, // No ack watchers to clear in this context
        sessionName,
        dataPath: config.wa.remoteAuth.dataPath || "./data/remote-session",
        logger: this.logger,
      });

      this.logger.info("Session cleared successfully");
    } catch (err) {
      this.logger.error({ err }, "Failed to clear session");
      throw err;
    }
  }
}
