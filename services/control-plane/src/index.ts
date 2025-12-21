import Fastify, {
  FastifyRequest,
  FastifyReply,
  type FastifyInstance,
} from "fastify";
import crypto from "node:crypto";
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

let sharedQueue: Queue | null = null;
let sharedRedisInstance: Redis | null = null;

async function getSharedRedis(): Promise<Redis> {
  if (sharedRedisInstance) return sharedRedisInstance;

  sharedRedisInstance = await getConnectedSharedRedis("control-plane");
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
  const expectedHash = crypto
    .createHash("sha256")
    .update(expectedToken)
    .digest();

  return function authHook(
    req: FastifyRequest,
    reply: FastifyReply,
    done: (err?: Error) => void,
  ) {
    const rawHeader = req.headers["authorization"];
    if (Array.isArray(rawHeader) && rawHeader.length !== 1) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    const headerValue = Array.isArray(rawHeader)
      ? (rawHeader[0] ?? "")
      : (rawHeader ?? "");
    const trimmed = headerValue.trim();
    const token = trimmed.startsWith("Bearer ")
      ? trimmed.slice(7).trim()
      : trimmed;
    const tokenHash = crypto.createHash("sha256").update(token).digest();

    let matches = false;
    try {
      matches = crypto.timingSafeEqual(tokenHash, expectedHash);
    } catch {
      matches = false;
    }

    if (!matches) {
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
        "SELECT COUNT(*) AS scans, SUM(CASE WHEN verdict = ? THEN 1 ELSE 0 END) AS malicious FROM scans",
        ["malicious"],
      );
      const stats = rows[0] as {
        scans: number | string;
        malicious: number | string;
      };
      return {
        scans: Number(stats.scans),
        malicious: Number(stats.malicious || 0),
      };
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
