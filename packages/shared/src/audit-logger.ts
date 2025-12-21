import { logger } from "./log";

export interface AuditLogEntry {
  actor: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface PersistedAuditLogEntry {
  actor: string;
  action: string;
  target: string | null;
  timestamp: Date;
  metadata: Record<string, unknown> | undefined;
  metadataJson: string | null;
}

export interface AuditLoggerConfig {
  persist?: (entry: PersistedAuditLogEntry) => Promise<void>;
  enabled?: boolean;
}

/**
 * Audit logger for security-sensitive operations.
 * Logs to both database and structured log output.
 */
export class AuditLogger {
  private readonly persist?: AuditLoggerConfig["persist"];
  private readonly enabled: boolean;

  constructor(config: AuditLoggerConfig) {
    this.persist = config.persist;
    this.enabled = config.enabled ?? true;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    const timestamp = entry.timestamp ?? new Date();
    const metadata = entry.metadata ? JSON.stringify(entry.metadata) : null;

    // Always log to structured output
    logger.info(
      {
        auditEvent: true,
        actor: entry.actor,
        action: entry.action,
        target: entry.target,
        metadata: entry.metadata,
      },
      `Audit: ${entry.action}`,
    );

    if (!this.enabled || !this.persist) {
      return;
    }

    // Persist to database
    try {
      await this.persist({
        actor: entry.actor,
        action: entry.action,
        target: entry.target ?? null,
        timestamp,
        metadata: entry.metadata,
        metadataJson: metadata,
      });
    } catch (error) {
      logger.error(
        { error, entry },
        "Failed to persist audit log entry to database",
      );
    }
  }

  async logSessionEvent(
    sessionId: string,
    event: "created" | "validated" | "invalidated" | "rotated" | "expired",
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      actor: "system",
      action: `session:${event}`,
      target: sessionId,
      metadata: details,
    });
  }

  async logAuthEvent(
    actor: string,
    event: "login" | "logout" | "failed" | "token_refresh",
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      actor,
      action: `auth:${event}`,
      metadata: details,
    });
  }

  async logAdminAction(
    actor: string,
    action: string,
    target: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      actor,
      action: `admin:${action}`,
      target,
      metadata: details,
    });
  }

  async logSecurityEvent(
    event: string,
    severity: "info" | "warning" | "critical",
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      actor: "system",
      action: `security:${event}`,
      metadata: { severity, ...details },
    });
  }

  async logOverrideChange(
    actor: string,
    action: "create" | "update" | "delete",
    urlHash: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      actor,
      action: `override:${action}`,
      target: urlHash,
      metadata: details,
    });
  }

  async logScanEvent(
    urlHash: string,
    event: "requested" | "completed" | "failed",
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      actor: "system",
      action: `scan:${event}`,
      target: urlHash,
      metadata: details,
    });
  }
}

/**
 * Creates an audit logger instance.
 */
export function createAuditLogger(config: AuditLoggerConfig): AuditLogger {
  return new AuditLogger(config);
}
