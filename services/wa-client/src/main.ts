/**
 * WA Client Main Entry Point (Adapter-based)
 *
 * This is the new entry point that uses the adapter pattern to support
 * both Baileys and whatsapp-web.js libraries. Set WA_LIBRARY environment
 * variable to choose the library:
 *
 *   WA_LIBRARY=baileys   - Use Baileys (recommended, default)
 *   WA_LIBRARY=wwebjs    - Use whatsapp-web.js (legacy)
 *
 * For the legacy whatsapp-web.js-only entry point, use index.ts.
 */

import Fastify from "fastify";
import { Queue, Worker } from "bullmq";

import {
  config,
  logger,
  metrics,
  register,
  assertEssentialConfig,
  assertControlPlaneToken,
  createRedisConnection,
  connectRedis,
} from "@wbscanner/shared";

import {
  createAdapterFromEnv,
  getConfiguredLibrary,
  LIBRARY_INFO,
  type WhatsAppAdapter,
} from "./adapters/index.js";
import { createMessageHandler } from "./handlers/index.js";
import { computeWaHealthStatus } from "./healthStatus.js";
import type { DisconnectReason } from "./adapters/types.js";

// Global state
let adapter: WhatsAppAdapter | null = null;
let scanRequestQueue: Queue | null = null;
let scanVerdictWorker: Worker | null = null;
let cachedQr: string | null = null;
let lastDisconnectReason: DisconnectReason | null = null;

interface VerdictJobData {
  chatId: string;
  messageId: string;
  verdict: string;
  reasons: string[];
  url: string;
  urlHash: string;
  decidedAt?: number;
}

function formatVerdictMessage(
  verdict: string,
  reasons: string[],
  url: string,
): string {
  const level = verdict.toUpperCase();
  let advice = "Use caution.";
  if (verdict === "malicious") advice = "Do NOT open.";
  if (verdict === "benign") advice = "Looks okay, stay vigilant.";
  const reasonsStr = reasons.slice(0, 3).join("; ");
  return `Link scan: ${level}\nURL: ${url}\n${advice}${reasonsStr ? `\nWhy: ${reasonsStr}` : ""}`;
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Received shutdown signal");

  try {
    if (adapter) {
      await adapter.disconnect();
    }
    if (scanRequestQueue) {
      await scanRequestQueue.close();
    }
    if (scanVerdictWorker) {
      await scanVerdictWorker.close();
    }
    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Validate configuration
  assertEssentialConfig("wa-client");
  assertControlPlaneToken();

  // Log library selection
  const library = getConfiguredLibrary();
  const libraryInfo = LIBRARY_INFO[library];
  logger.info(
    { library, name: libraryInfo.name, recommended: libraryInfo.recommended },
    "Starting WA Client with adapter",
  );

  // Connect to Redis
  const redis = createRedisConnection();
  try {
    await connectRedis(redis, "wa-client");
  } catch (err) {
    logger.error({ err }, "Failed to connect to Redis. Exiting...");
    process.exit(1);
  }

  // Create scan request queue
  scanRequestQueue = new Queue(config.queues.scanRequest, {
    connection: redis,
  });

  scanVerdictWorker = new Worker(
    config.queues.scanVerdict,
    async (job) => {
      if (!adapter) {
        throw new Error("Adapter not initialized");
      }

      const started = Date.now();
      const data = job.data as VerdictJobData;
      const decidedAt = data.decidedAt ?? job.timestamp ?? started;

      const verdictLatencySeconds = Math.max(
        0,
        (Date.now() - decidedAt) / 1000,
      );
      metrics.waVerdictLatency.observe(verdictLatencySeconds);

      const tsKey = `wa:msg_ts:${data.chatId}:${data.messageId}`;
      const originalTsRaw = await redis.get(tsKey);
      const originalTs = originalTsRaw
        ? Number.parseInt(originalTsRaw, 10)
        : NaN;
      if (Number.isFinite(originalTs)) {
        const responseLatencySeconds = Math.max(
          0,
          (Date.now() - originalTs) / 1000,
        );
        metrics.waResponseLatency.observe(responseLatencySeconds);
      }

      const text = formatVerdictMessage(
        data.verdict,
        data.reasons ?? [],
        data.url,
      );

      const result = await adapter.sendMessage(
        data.chatId,
        { type: "text", text },
        { quotedMessageId: data.messageId },
      );

      if (!result.success) {
        metrics.waVerdictFailures.inc();
        throw new Error("Failed to send verdict message");
      }

      metrics.waVerdictsSent.inc();
      logger.info(
        {
          chatId: data.chatId,
          messageId: data.messageId,
          verdict: data.verdict,
          processingMs: Date.now() - started,
        },
        "Verdict sent",
      );
    },
    { connection: redis },
  );

  // Create WhatsApp adapter (async to support dynamic imports)
  adapter = await createAdapterFromEnv(redis, logger);

  // Set up connection handlers
  adapter.onConnectionChange((state) => {
    logger.info({ state }, "Connection state changed");
    // Connection state metric (if available)
  });

  adapter.onDisconnect((reason) => {
    logger.warn({ reason }, "Disconnected from WhatsApp");
    lastDisconnectReason = reason;
    if (reason.shouldReconnect) {
      logger.info("Will attempt to reconnect...");
    }
  });

  adapter.onQRCode((qr) => {
    logger.info("QR code received - scan with WhatsApp to authenticate");
    // Cache QR for HTTP endpoint
    cachedQr = qr;
    // Print QR to terminal if configured - use small format for better fit
    if (config.wa.remoteAuth.disableQrFallback !== true) {
      import("qrcode-terminal")
        .then((mod) => {
          const qrTerminal = (mod as unknown as { default?: unknown }).default ?? mod;
          const generator = qrTerminal as unknown as {
            generate?: (text: string, opts?: { small?: boolean }) => void;
          };

          if (typeof generator.generate !== "function") {
            throw new TypeError("qrcode-terminal export did not provide generate() ");
          }

          console.log("\n  ╔════════════════════════════════════╗");
          console.log("  ║     📱 SCAN QR CODE WITH WHATSAPP  ║");
          console.log("  ╚════════════════════════════════════╝\n");
          // small: true generates a compact QR that fits standard terminals
          generator.generate(qr, { small: true });
          console.log("\n  Open WhatsApp → Settings → Linked Devices → Link\n");
        })
        .catch((err) => {
          logger.warn({ err }, "Failed to print QR to terminal");
        });
    }
  });

  // Clear cached QR on successful connection
  adapter.onConnectionChange((state) => {
    if (state === "ready") {
      cachedQr = null;
    }
  });

  adapter.onPairingCode((code) => {
    logger.info(
      { code },
      "Pairing code received - enter in WhatsApp > Linked Devices",
    );
  });

  // Create and start message handler
  const messageHandler = createMessageHandler({
    adapter,
    redis,
    logger,
    scanRequestQueue,
  });
  messageHandler.start();

  // Create Fastify server for health checks and metrics
  const server = Fastify({ logger: false });

  // Health check endpoint (both /health and /healthz for compatibility)
  const healthHandler = async () => {
    const qrAvailable = cachedQr !== null;
    const state = adapter?.state ?? "unknown";
    const lastError = lastDisconnectReason
      ? {
          code: lastDisconnectReason.code,
          message: lastDisconnectReason.message,
        }
      : null;

    const hint = lastDisconnectReason?.message?.includes(
      "Opening handshake has timed out",
    )
      ? "Outbound WhatsApp WebSocket handshake timed out. Check outbound connectivity, DNS, and firewall rules."
      : lastDisconnectReason?.message?.includes("QR refs attempts ended")
        ? "QR was not scanned before it expired. Fetch a fresh QR from /qr and scan within ~60s."
        : null;
    return {
      status: computeWaHealthStatus({ state, qrAvailable }),
      library,
      state,
      qrAvailable,
      botId: adapter?.botId ?? null,
      lastError,
      hint,
    };
  };
  server.get("/health", healthHandler);
  server.get("/healthz", healthHandler);

  // Metrics endpoint
  server.get("/metrics", async (_, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });

  // Library info endpoint
  server.get("/library", async () => {
    return {
      current: library,
      info: libraryInfo,
      available: LIBRARY_INFO,
    };
  });

  // Pairing code request endpoint
  server.post<{
    Body?: { phoneNumber?: string };
    Reply: {
      success: boolean;
      code?: string;
      error?: string;
      qrAvailable?: boolean;
      retryAfterMs?: number;
    };
  }>("/pair", async (request, reply) => {
    if (!adapter) {
      return reply.status(503).send({
        success: false,
        error: "WhatsApp adapter not initialized",
      });
    }

    // Check if socket is ready for pairing (QR should be generated first)
    if (!cachedQr && adapter.state === "connecting") {
      // Socket is connecting but QR not yet generated - ask client to retry
      return reply.status(202).send({
        success: false,
        error:
          "Socket connecting, waiting for QR generation. Retry in 2 seconds.",
        retryAfterMs: 2000,
      });
    }

    if (adapter.state === "ready") {
      return reply.status(200).send({
        success: true,
        error: "Already connected, no pairing needed",
      });
    }

    // Get phone number from request body or environment
    let phoneNumber =
      request.body?.phoneNumber ??
      process.env.WA_REMOTE_AUTH_PHONE_NUMBERS?.split(",")[0]?.trim() ??
      process.env.WA_REMOTE_AUTH_PHONE_NUMBER;

    if (!phoneNumber) {
      return reply.status(400).send({
        success: false,
        error:
          "Phone number required. Set WA_REMOTE_AUTH_PHONE_NUMBERS in .env or provide phoneNumber in request body",
        qrAvailable: true, // QR code is available as alternative
      });
    }

    // Clean the phone number (remove non-digits except leading +)
    phoneNumber = phoneNumber.replaceAll(/[^\d+]/g, "").replace(/^\+/, "");

    try {
      const code = await adapter.requestPairingCode(phoneNumber);
      logger.info(
        { phoneNumber: phoneNumber.slice(-4) },
        "Pairing code requested successfully",
      );
      return { success: true, code };
    } catch (err) {
      const error = err as Error;
      logger.error(
        { err, phoneNumber: phoneNumber.slice(-4) },
        "Failed to request pairing code",
      );

      // Check for rate limiting
      if (error.message?.includes("rate") || error.message?.includes("429")) {
        return reply.status(429).send({
          success: false,
          error: "Rate limited by WhatsApp. Wait 15 minutes before retrying.",
          qrAvailable: true,
        });
      }

      return reply.status(500).send({
        success: false,
        error: error.message || "Failed to request pairing code",
        qrAvailable: true,
      });
    }
  });

  // QR code endpoint (returns current QR if available)
  server.get<{
    Reply: { success: boolean; qr?: string; state?: string; error?: string };
  }>("/qr", async (_, reply) => {
    if (!adapter) {
      return reply.status(503).send({
        success: false,
        error: "WhatsApp adapter not initialized",
      });
    }

    const state = adapter.state;

    if (state === "ready") {
      return { success: true, state, error: "Already connected, no QR needed" };
    }

    // Return cached QR if available
    if (cachedQr) {
      return { success: true, qr: cachedQr, state };
    }

    return {
      success: false,
      state,
      error:
        state === "connecting"
          ? "QR code not yet generated. Wait a moment and retry, or use /pair for pairing code"
          : "Not connected. Restart wa-client to generate new QR code",
    };
  });

  // Connection state endpoint
  server.get("/state", async () => {
    return {
      state: adapter?.state ?? "unknown",
      botId: adapter?.botId ?? null,
      library,
      lastError: lastDisconnectReason
        ? {
            code: lastDisconnectReason.code,
            message: lastDisconnectReason.message,
          }
        : null,
    };
  });

  // Start HTTP server
  const port = Number.parseInt(process.env.WA_HTTP_PORT ?? "3001", 10);
  await server.listen({ port, host: "0.0.0.0" });
  logger.info({ port }, "HTTP server started");

  // Connect to WhatsApp
  logger.info("Connecting to WhatsApp...");
  await adapter.connect();

  // Register shutdown handlers
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("WA Client started successfully");
}

// Run main
try {
  await main();
} catch (err) {
  logger.error({ err }, "Fatal error in main");
  process.exit(1);
}
