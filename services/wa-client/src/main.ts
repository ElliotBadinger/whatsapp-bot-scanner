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
import { Queue } from "bullmq";

import {
  config,
  logger,
  register,
  metrics,
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

// Global state
let adapter: WhatsAppAdapter | null = null;
let scanRequestQueue: Queue | null = null;

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

  // Create WhatsApp adapter
  adapter = createAdapterFromEnv(redis, logger);

  // Set up connection handlers
  adapter.onConnectionChange((state) => {
    logger.info({ state }, "Connection state changed");
    // Connection state metric (if available)
  });

  adapter.onDisconnect((reason) => {
    logger.warn({ reason }, "Disconnected from WhatsApp");
    if (reason.shouldReconnect) {
      logger.info("Will attempt to reconnect...");
    }
  });

  adapter.onQRCode((qr) => {
    logger.info("QR code received - scan with WhatsApp to authenticate");
    // Print QR to terminal if configured
    if (config.wa.remoteAuth.disableQrFallback !== true) {
      import("qrcode-terminal").then((qrTerminal) => {
        qrTerminal.generate(qr, { small: true });
      });
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
    return {
      status: adapter?.state === "ready" ? "healthy" : "degraded",
      library,
      state: adapter?.state ?? "unknown",
      botId: adapter?.botId ?? null,
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

  // Start HTTP server
  const port = parseInt(process.env.WA_HTTP_PORT ?? "3001", 10);
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
main().catch((err) => {
  logger.error({ err }, "Fatal error in main");
  process.exit(1);
});
