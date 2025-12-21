import Fastify, {
  FastifyRequest,
  FastifyReply,
  type FastifyInstance,
} from "fastify";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import Redis from "ioredis";
import { Queue } from "bullmq";
import {
  register,
  metrics,
  config,
  logger,
  assertControlPlaneToken,
  normalizeUrl,
  urlHash,
  hashChatId,
  assertEssentialConfig,
  OverrideBodySchema,
  RescanBodySchema,
  MuteGroupParamsSchema,
  getConnectedSharedRedis,
  ValidationError,
  globalErrorHandler,
} from "@wbscanner/shared";
import { getSharedConnection } from "./database.js";

const artifactRoot = path.resolve(
  process.env.URLSCAN_ARTIFACT_DIR || "storage/urlscan-artifacts",
);
const SCAN_LAST_MESSAGE_PREFIX = "scan:last-message:";
const DEFAULT_SCANS_LIMIT = 50;
const DEFAULT_RECENT_SCANS_LIMIT = 10;
const MAX_SCANS_LIMIT = 100;
const ALLOWED_SCAN_VERDICTS = new Set(["benign", "suspicious", "malicious"]);

type ScanTimestampError = "invalid_from" | "invalid_to";
type TimestampParseResult =
  | { ok: true; value: Date | null }
  | { ok: false; error: ScanTimestampError };

const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function parseScanTimestamp(
  value: unknown,
  error: ScanTimestampError,
): TimestampParseResult {
  if (typeof value === "undefined" || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false, error };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  if (!ISO_DATETIME_PATTERN.test(trimmed)) {
    return { ok: false, error };
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error };
  }

  return { ok: true, value: date };
}

let sharedQueue: Queue | null = null;
let sharedRedisInstance: Redis | undefined;

async function getSharedRedis(): Promise<Redis> {
  if (!sharedRedisInstance) {
    sharedRedisInstance = await getConnectedSharedRedis("control-plane");
  }
  return sharedRedisInstance;
}

async function getSharedQueue(): Promise<Queue> {
  if (!sharedQueue) {
    const redis = await getSharedRedis();
    sharedQueue = new Queue(config.queues.scanRequest, { connection: redis });
  }
  return sharedQueue;
}

function createAuthHook(expectedToken: string) {
  return function authHook(
    req: FastifyRequest,
    reply: FastifyReply,
    done: (err?: Error) => void,
  ) {
    const hdr = req.headers["authorization"] || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : hdr;
    if (token !== expectedToken) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    done();
  };
}

export interface BuildOptions {
  dbClient?: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  redisClient?: Redis;
  queue?: Queue;
}

export async function buildServer(options: BuildOptions = {}) {
  assertEssentialConfig("control-plane");
  const requiredToken = assertControlPlaneToken();
  const dbClient = options.dbClient ?? getSharedConnection();
  const ownsClient = !options.dbClient;
  const redisClient = options.redisClient ?? (await getSharedRedis());
  const queue = options.queue ?? (await getSharedQueue());

  const app = Fastify();
  app.setErrorHandler(globalErrorHandler);

  // Public routes (no auth required) - must be registered before the auth hook
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });

  await app.register(async (protectedApp: FastifyInstance) => {
    protectedApp.addHook("preHandler", createAuthHook(requiredToken));

    protectedApp.get("/status", async () => {
      const { rows } = await dbClient.query(
        "SELECT (SELECT COUNT(*) FROM scans) AS scans, (SELECT COUNT(*) FROM scans WHERE verdict = ?) AS malicious, (SELECT COUNT(*) FROM groups) AS groups",
        ["malicious"],
      );
      const stats = rows[0] as {
        scans: number | string;
        malicious: number | string;
        groups: number | string;
      };
      return {
        scans: Number(stats.scans),
        malicious: Number(stats.malicious || 0),
        groups: Number(stats.groups || 0),
      };
    });

    protectedApp.get("/scans", async (req, reply) => {
      const query = req.query as {
        verdict?: string;
        from?: string;
        to?: string;
        limit?: string | number;
        offset?: string | number;
      };

      const rawVerdict =
        typeof query.verdict === "string" && query.verdict.trim().length > 0
          ? query.verdict.trim()
          : null;
      const verdict = rawVerdict ? rawVerdict.toLowerCase() : null;
      if (verdict && !ALLOWED_SCAN_VERDICTS.has(verdict)) {
        return reply.code(400).send({ error: "invalid_verdict" });
      }

      const fromRes = parseScanTimestamp(query.from, "invalid_from");
      if (!fromRes.ok) {
        return reply.code(400).send({ error: fromRes.error });
      }
      const toRes = parseScanTimestamp(query.to, "invalid_to");
      if (!toRes.ok) {
        return reply.code(400).send({ error: toRes.error });
      }

      const from = fromRes.value;
      const to = toRes.value;

      if (from && to) {
        if (from.getTime() > to.getTime()) {
          return reply.code(400).send({ error: "invalid_date_range" });
        }
      }

      const rawLimit = query.limit;
      const parsedLimit = Number.parseInt(
        String(rawLimit ?? DEFAULT_SCANS_LIMIT),
        10,
      );
      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
        return reply.code(400).send({ error: "invalid_limit" });
      }
      const limit = Math.min(parsedLimit, MAX_SCANS_LIMIT);

      const rawOffset = query.offset;
      const parsedOffset = Number.parseInt(String(rawOffset ?? "0"), 10);
      if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
        return reply.code(400).send({ error: "invalid_offset" });
      }
      const offset = parsedOffset;

      const whereParts: string[] = [];
      const whereParams: unknown[] = [];

      if (verdict) {
        whereParts.push("verdict = ?");
        whereParams.push(verdict);
      }
      if (from) {
        whereParts.push("last_seen_at >= ?");
        whereParams.push(from.toISOString());
      }
      if (to) {
        whereParts.push("last_seen_at <= ?");
        whereParams.push(to.toISOString());
      }

      const whereClause = whereParts.length
        ? `WHERE ${whereParts.join(" AND ")}`
        : "";

      try {
        const filterParams = [...whereParams];
        const listParams = [...whereParams, limit, offset];
        const { rows: countRows } = await dbClient.query(
          `SELECT COUNT(*) AS total FROM scans ${whereClause}`,
          filterParams,
        );
        const { rows: scanRows } = await dbClient.query(
          `SELECT id, url_hash, normalized_url, verdict, last_seen_at FROM scans ${whereClause} ORDER BY last_seen_at DESC, id DESC LIMIT ? OFFSET ?`,
          listParams,
        );
        const totalRow = countRows[0] as { total?: number | string } | undefined;

        return {
          total: Number(totalRow?.total ?? 0),
          limit,
          offset,
          items: scanRows,
        };
      } catch (err) {
        logger.error(
          {
            err,
            verdict,
            from: from?.toISOString() ?? null,
            to: to?.toISOString() ?? null,
            limit,
            offset,
          },
          "Failed to list scans",
        );
        return reply.code(500).send({ error: "scans_unavailable" });
      }
    });

    protectedApp.get("/scans/recent", async (req, reply) => {
      const rawLimit = (req.query as { limit?: string | number })?.limit;
      const parsedLimit = Number.parseInt(
        String(rawLimit ?? DEFAULT_RECENT_SCANS_LIMIT),
        10,
      );
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(parsedLimit, MAX_SCANS_LIMIT)
          : DEFAULT_RECENT_SCANS_LIMIT;

      const rawAfter = (req.query as { after?: string })?.after;
      let after: { lastSeenAt: string; id: number } | null = null;
      if (typeof rawAfter === "string" && rawAfter.trim().length > 0) {
        try {
          const decoded = Buffer.from(rawAfter, "base64url").toString("utf8");
          const parsed = JSON.parse(decoded) as unknown;
          if (!parsed || typeof parsed !== "object") {
            throw new Error("Invalid cursor payload");
          }
          const obj = parsed as { ts?: unknown; id?: unknown };
          const lastSeenAt =
            typeof obj.ts === "string" && obj.ts.trim().length > 0
              ? obj.ts
              : null;
          const rawId = String(obj.id ?? "").trim();
          const parsedId =
            rawId.length > 0 && /^[0-9]+$/.test(rawId)
              ? Number.parseInt(rawId, 10)
              : Number.NaN;
          const parsedDate = lastSeenAt ? new Date(lastSeenAt) : null;

          if (
            !lastSeenAt ||
            !parsedDate ||
            Number.isNaN(parsedDate.getTime()) ||
            !Number.isSafeInteger(parsedId) ||
            parsedId < 0
          ) {
            throw new Error("Invalid cursor fields");
          }

          after = { lastSeenAt, id: parsedId };
        } catch {
          return reply.code(400).send({ error: "invalid_after_cursor" });
        }
      }

      try {
        const orderBy = after
          ? "ORDER BY last_seen_at ASC, id ASC"
          : "ORDER BY last_seen_at DESC, id DESC";

        const { rows } = await dbClient.query(
          after
            ? `SELECT id, url_hash, normalized_url, verdict, last_seen_at FROM scans WHERE last_seen_at > ? OR (last_seen_at = ? AND id > ?) ${orderBy} LIMIT ?`
            : `SELECT id, url_hash, normalized_url, verdict, last_seen_at FROM scans ${orderBy} LIMIT ?`,
          after
            ? [after.lastSeenAt, after.lastSeenAt, after.id, limit]
            : [limit],
        );
        return rows;
      } catch (err) {
        logger.error({ err, limit, after }, "Failed to list recent scans");
        return reply.code(500).send({ error: "recent_scans_unavailable" });
      }
    });

    interface OverrideBody {
      url_hash?: string;
      pattern?: string;
      status: string;
      scope?: string;
      scope_id?: string;
      reason?: string;
      expires_at?: string;
    }

    protectedApp.post("/overrides", async (req, reply) => {
      const validation = OverrideBodySchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error);
      }
      const body = validation.data;
      await dbClient.query(
        `INSERT INTO overrides (url_hash, pattern, status, scope, scope_id, created_by, reason, expires_at)
      VALUES (?,?,?,?,?,?,?,?)`,
        [
          body.url_hash || null,
          body.pattern || null,
          body.status,
          body.scope || "global",
          body.scope_id || null,
          "admin",
          body.reason || null,
          body.expires_at || null,
        ],
      );
      reply.code(201).send({ ok: true });
    });

    protectedApp.get("/overrides", async () => {
      const { rows } = await dbClient.query(
        "SELECT * FROM overrides ORDER BY created_at DESC LIMIT 100",
      );
      return rows;
    });

    protectedApp.post("/groups/:chatId/mute", async (req, reply) => {
      const validation = MuteGroupParamsSchema.safeParse(req.params);
      if (!validation.success) {
        throw new ValidationError(validation.error);
      }
      const { chatId } = validation.data;
      const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const chatIdHash = hashChatId(chatId);
      await dbClient.query(
        "INSERT INTO groups (chat_id, chat_id_hash, muted_until) VALUES (?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET muted_until=excluded.muted_until, chat_id_hash=excluded.chat_id_hash",
        [chatIdHash, chatIdHash, until],
      );
      reply.send({ ok: true, muted_until: until });
    });

    protectedApp.post("/groups/:chatId/unmute", async (req, reply) => {
      const validation = MuteGroupParamsSchema.safeParse(req.params);
      if (!validation.success) {
        throw new ValidationError(validation.error);
      }
      const { chatId } = validation.data;
      const chatIdHash = hashChatId(chatId);
      await dbClient.query(
        "INSERT INTO groups (chat_id, chat_id_hash, muted_until) VALUES (?, ?, NULL) ON CONFLICT(chat_id) DO UPDATE SET muted_until=NULL, chat_id_hash=excluded.chat_id_hash",
        [chatIdHash, chatIdHash],
      );
      reply.send({ ok: true });
    });

    protectedApp.post("/rescan", async (req, reply) => {
      const validation = RescanBodySchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error);
      }
      const { url } = validation.data;
      const normalized = normalizeUrl(url);
      if (!normalized) {
        reply.code(400).send({ error: "invalid_url" });
        return;
      }
      const hash = urlHash(normalized);
      const keys = [
        `scan:${hash}`,
        `url:verdict:${hash}`,
        `url:analysis:${hash}:vt`,
        `url:analysis:${hash}:gsb`,
        `url:analysis:${hash}:whois`,
        `url:analysis:${hash}:phishtank`,
        `url:analysis:${hash}:urlhaus`,
        `url:shortener:${hash}`,
      ];
      await Promise.all(keys.map((key) => redisClient.del(key)));

      let latestMessage: { chatId?: string; messageId?: string } | undefined;
      const raw = await redisClient.get(`${SCAN_LAST_MESSAGE_PREFIX}${hash}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            chatId?: string;
            messageId?: string;
          };
          latestMessage = parsed;
        } catch {
          latestMessage = undefined;
        }
      }

      const rescanJob = {
        url: normalized,
        urlHash: hash,
        rescan: true,
        priority: 1,
        timestamp: Date.now(),
        ...(latestMessage?.chatId && latestMessage?.messageId
          ? {
              chatId: latestMessage.chatId,
              messageId: latestMessage.messageId,
            }
          : {}),
      };

      const job = await queue.add("rescan", rescanJob, {
        removeOnComplete: true,
        removeOnFail: 100,
        priority: 1,
      });
      metrics.rescanRequests.labels("control-plane").inc();
      reply.send({ ok: true, urlHash: hash, jobId: job.id });
    });

    function isWithinArtifactRoot(resolvedPath: string): boolean {
      const relative = path.relative(artifactRoot, resolvedPath);
      if (!relative) return true;
      return !relative.startsWith("..") && !path.isAbsolute(relative);
    }

    protectedApp.get(
      "/scans/:urlHash/urlscan-artifacts/:type",
      async (req, reply) => {
        const { urlHash: hash, type } = req.params as {
          urlHash: string;
          type: string;
        };

        // Validate urlHash format to prevent path traversal (SHA-256 hex string)
        if (typeof hash !== "string" || !/^[a-fA-F0-9]{64}$/.test(hash)) {
          reply.code(400).send({ error: "invalid_url_hash" });
          return;
        }

        if (type !== "screenshot" && type !== "dom") {
          reply.code(400).send({ error: "invalid_artifact_type" });
          return;
        }

        const column =
          type === "screenshot"
            ? "urlscan_screenshot_path"
            : "urlscan_dom_path";
        const { rows } = await dbClient.query(
          `SELECT ${column} FROM scans WHERE url_hash=? LIMIT 1`,
          [hash],
        );
        const record = rows[0] as Record<string, string> | undefined;
        const filePath = record?.[column];
        if (!filePath) {
          reply.code(404).send({ error: `${type}_not_found` });
          return;
        }

        const resolvedPath = path.resolve(filePath);
        if (!isWithinArtifactRoot(resolvedPath)) {
          reply.code(403).send({ error: "access_denied" });
          return;
        }

        if (type === "screenshot") {
          try {
            await fs.access(resolvedPath);
          } catch (error: unknown) {
            const err = error as { code?: string };
            if (err?.code === "ENOENT") {
              reply.code(404).send({ error: "screenshot_not_found" });
            } else {
              reply.code(500).send({ error: "artifact_unavailable" });
            }
            return;
          }
          const stream = createReadStream(resolvedPath);
          reply.header("Content-Type", "image/png");
          reply.send(stream);
          return;
        }

        try {
          const html = await fs.readFile(resolvedPath, "utf8");
          reply.header("Content-Type", "text/html; charset=utf-8");
          reply.send(html);
        } catch (error: unknown) {
          const err = error as { code?: string };
          if (err?.code === "ENOENT") {
            reply.code(404).send({ error: "dom_not_found" });
          } else {
            reply.code(500).send({ error: "artifact_unavailable" });
          }
        }
      },
    );
  });

  if (process.env.NODE_ENV !== "test") {
    setInterval(
      async () => {
        try {
          await dbClient.query(
            "DELETE FROM scans WHERE last_seen_at < datetime('now', '-30 days')",
          );
        } catch (e) {
          logger.error(e, "purge job failed");
        }
      },
      24 * 60 * 60 * 1000,
    );
  }

  return { app, dbClient, ownsClient };
}

async function main() {
  assertControlPlaneToken();
  const { app } = await buildServer();
  await app.listen({ host: "0.0.0.0", port: config.controlPlane.port });
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    logger.error(err, "Fatal in control-plane");
    process.exit(1);
  });
}
