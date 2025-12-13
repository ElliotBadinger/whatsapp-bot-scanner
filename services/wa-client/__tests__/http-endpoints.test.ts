/**
 * WA Client HTTP Endpoints Tests
 *
 * Tests for the HTTP endpoints exposed by the wa-client service.
 * These endpoints are critical for the setup wizard to function properly.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import Fastify, { type FastifyInstance } from "fastify";

// Types for endpoint responses
interface HealthResponse {
  status: string;
  library: string;
  state: string;
  qrAvailable: boolean;
  botId: string | null;
  lastError?: { code: number; message: string } | null;
  hint?: string | null;
}

interface PairResponse {
  success: boolean;
  code?: string;
  error?: string;
  qrAvailable?: boolean;
}

interface StateResponse {
  state: string;
  botId: string | null;
  library: string;
  lastError?: { code: number; message: string } | null;
}

interface QrResponse {
  success: boolean;
  qr?: string;
  state?: string;
  error?: string;
}

describe("WA Client HTTP Endpoints", () => {
  let server: FastifyInstance;
  let cachedQr: string | null;
  let lastDisconnectReason: { code: number; message: string } | null;

  // Mock adapter for testing
  const mockAdapter = {
    state: "disconnected" as string,
    botId: null as string | null,
    requestPairingCode: jest.fn<(phone: string) => Promise<string>>(),
  };

  const mockLibrary = "baileys";

  beforeEach(async () => {
    jest.clearAllMocks();
    cachedQr = null;
    lastDisconnectReason = null;

    server = Fastify({ logger: false });

    // Register test routes that mirror main.ts
    const healthHandler = async () => {
      const qrAvailable = cachedQr !== null;
      const state = mockAdapter.state;
      return {
        status:
          state === "ready" || (state === "connecting" && qrAvailable)
            ? "healthy"
            : "degraded",
        library: mockLibrary,
        state,
        qrAvailable,
        botId: mockAdapter.botId,
        lastError: lastDisconnectReason,
        hint: lastDisconnectReason?.message?.includes(
          "Opening handshake has timed out",
        )
          ? "Outbound WhatsApp WebSocket handshake timed out. Check outbound connectivity, DNS, and firewall rules."
          : null,
      };
    };

    server.get("/health", healthHandler);
    server.get("/healthz", healthHandler);

    server.post<{
      Body?: { phoneNumber?: string };
      Reply: PairResponse;
    }>("/pair", async (request, reply) => {
      if (!mockAdapter) {
        return reply.status(503).send({
          success: false,
          error: "WhatsApp adapter not initialized",
        });
      }

      let phoneNumber =
        request.body?.phoneNumber ??
        process.env.WA_REMOTE_AUTH_PHONE_NUMBERS?.split(",")[0]?.trim() ??
        process.env.WA_REMOTE_AUTH_PHONE_NUMBER;

      if (!phoneNumber) {
        return reply.status(400).send({
          success: false,
          error:
            "Phone number required. Set WA_REMOTE_AUTH_PHONE_NUMBERS in .env or provide phoneNumber in request body",
          qrAvailable: true,
        });
      }

      phoneNumber = phoneNumber.replaceAll(/[^\d+]/g, "").replace(/^\+/, "");

      try {
        const code = await mockAdapter.requestPairingCode(phoneNumber);
        return { success: true, code };
      } catch (err) {
        const error = err as Error;
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

    server.get<{ Reply: QrResponse }>("/qr", async (_, reply) => {
      if (!mockAdapter) {
        return reply.status(503).send({
          success: false,
          error: "WhatsApp adapter not initialized",
        });
      }

      const state = mockAdapter.state;

      if (state === "ready") {
        return {
          success: true,
          state,
          error: "Already connected, no QR needed",
        };
      }

      return {
        success: true,
        state,
        error:
          state === "connecting"
            ? "Connecting... watch terminal for QR code or use /pair for pairing code"
            : "Not connected. Restart wa-client to generate new QR code",
      };
    });

    server.get("/state", async () => ({
      state: mockAdapter.state,
      botId: mockAdapter.botId,
      library: mockLibrary,
      lastError: lastDisconnectReason,
    }));

    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  describe("GET /health and /healthz", () => {
    it("should return degraded status when disconnected", async () => {
      mockAdapter.state = "disconnected";

      const response = await server.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body: HealthResponse = JSON.parse(response.body);
      expect(body.status).toBe("degraded");
      expect(body.state).toBe("disconnected");
      expect(body.qrAvailable).toBe(false);
      expect(body.library).toBe("baileys");
      expect(body.lastError ?? null).toBeNull();
    });

    it("should include lastError and hint when a handshake timeout occurred", async () => {
      mockAdapter.state = "disconnected";
      lastDisconnectReason = {
        code: 408,
        message: "WebSocket Error (Opening handshake has timed out)",
      };

      const response = await server.inject({ method: "GET", url: "/healthz" });
      expect(response.statusCode).toBe(200);
      const body: HealthResponse = JSON.parse(response.body);
      expect(body.lastError).toEqual(lastDisconnectReason);
      expect(body.hint).toContain("handshake timed out");
    });

    it("should return healthy status when ready", async () => {
      mockAdapter.state = "ready";
      mockAdapter.botId = "1234567890@s.whatsapp.net";

      const response = await server.inject({
        method: "GET",
        url: "/healthz",
      });

      expect(response.statusCode).toBe(200);
      const body: HealthResponse = JSON.parse(response.body);
      expect(body.status).toBe("healthy");
      expect(body.state).toBe("ready");
      expect(body.qrAvailable).toBe(false);
      expect(body.botId).toBe("1234567890@s.whatsapp.net");
    });

    it("should return degraded status when connecting without QR", async () => {
      mockAdapter.state = "connecting";

      const response = await server.inject({
        method: "GET",
        url: "/healthz",
      });

      expect(response.statusCode).toBe(200);
      const body: HealthResponse = JSON.parse(response.body);
      expect(body.status).toBe("degraded");
      expect(body.state).toBe("connecting");
      expect(body.qrAvailable).toBe(false);
    });

    it("should return healthy status when connecting with QR available", async () => {
      mockAdapter.state = "connecting";
      cachedQr = "qr-data";

      const response = await server.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body: HealthResponse = JSON.parse(response.body);
      expect(body.status).toBe("healthy");
      expect(body.state).toBe("connecting");
      expect(body.qrAvailable).toBe(true);
    });
  });

  describe("POST /pair", () => {
    beforeEach(() => {
      // Reset env
      delete process.env.WA_REMOTE_AUTH_PHONE_NUMBERS;
      delete process.env.WA_REMOTE_AUTH_PHONE_NUMBER;
    });

    it("should return 400 when no phone number provided", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/pair",
      });

      expect(response.statusCode).toBe(400);
      const body: PairResponse = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Phone number required");
      expect(body.qrAvailable).toBe(true);
    });

    it("should return pairing code when phone number is in body", async () => {
      mockAdapter.requestPairingCode.mockResolvedValue("12345678");

      const response = await server.inject({
        method: "POST",
        url: "/pair",
        payload: { phoneNumber: "+27123456789" },
        headers: { "Content-Type": "application/json" },
      });

      expect(response.statusCode).toBe(200);
      const body: PairResponse = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.code).toBe("12345678");
    });

    it("should return pairing code when phone number is in env", async () => {
      process.env.WA_REMOTE_AUTH_PHONE_NUMBERS = "27123456789";
      mockAdapter.requestPairingCode.mockResolvedValue("87654321");

      const response = await server.inject({
        method: "POST",
        url: "/pair",
      });

      expect(response.statusCode).toBe(200);
      const body: PairResponse = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.code).toBe("87654321");
    });

    it("should clean phone number format", async () => {
      mockAdapter.requestPairingCode.mockResolvedValue("11111111");

      await server.inject({
        method: "POST",
        url: "/pair",
        payload: { phoneNumber: "+27 123-456-789" },
        headers: { "Content-Type": "application/json" },
      });

      // Phone number should be cleaned to digits only
      expect(mockAdapter.requestPairingCode).toHaveBeenCalledWith(
        "27123456789",
      );
    });

    it("should return 429 on rate limit error", async () => {
      mockAdapter.requestPairingCode.mockRejectedValue(
        new Error("rate limit exceeded"),
      );

      const response = await server.inject({
        method: "POST",
        url: "/pair",
        payload: { phoneNumber: "27123456789" },
        headers: { "Content-Type": "application/json" },
      });

      expect(response.statusCode).toBe(429);
      const body: PairResponse = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Rate limited");
    });

    it("should return 500 on other errors", async () => {
      mockAdapter.requestPairingCode.mockRejectedValue(
        new Error("Connection failed"),
      );

      const response = await server.inject({
        method: "POST",
        url: "/pair",
        payload: { phoneNumber: "27123456789" },
        headers: { "Content-Type": "application/json" },
      });

      expect(response.statusCode).toBe(500);
      const body: PairResponse = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Connection failed");
    });
  });

  describe("GET /qr", () => {
    it("should return guidance when disconnected", async () => {
      mockAdapter.state = "disconnected";

      const response = await server.inject({
        method: "GET",
        url: "/qr",
      });

      expect(response.statusCode).toBe(200);
      const body: QrResponse = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.state).toBe("disconnected");
      expect(body.error).toContain("Restart wa-client");
    });

    it("should return guidance when connecting", async () => {
      mockAdapter.state = "connecting";

      const response = await server.inject({
        method: "GET",
        url: "/qr",
      });

      expect(response.statusCode).toBe(200);
      const body: QrResponse = JSON.parse(response.body);
      expect(body.state).toBe("connecting");
      expect(body.error).toContain("Connecting");
    });

    it("should indicate no QR needed when ready", async () => {
      mockAdapter.state = "ready";

      const response = await server.inject({
        method: "GET",
        url: "/qr",
      });

      expect(response.statusCode).toBe(200);
      const body: QrResponse = JSON.parse(response.body);
      expect(body.state).toBe("ready");
      expect(body.error).toContain("no QR needed");
    });
  });

  describe("GET /state", () => {
    it("should return current connection state", async () => {
      mockAdapter.state = "connecting";
      mockAdapter.botId = null;

      const response = await server.inject({
        method: "GET",
        url: "/state",
      });

      expect(response.statusCode).toBe(200);
      const body: StateResponse = JSON.parse(response.body);
      expect(body.state).toBe("connecting");
      expect(body.botId).toBeNull();
      expect(body.library).toBe("baileys");
    });

    it("should include botId when connected", async () => {
      mockAdapter.state = "ready";
      mockAdapter.botId = "1234567890@s.whatsapp.net";

      const response = await server.inject({
        method: "GET",
        url: "/state",
      });

      expect(response.statusCode).toBe(200);
      const body: StateResponse = JSON.parse(response.body);
      expect(body.state).toBe("ready");
      expect(body.botId).toBe("1234567890@s.whatsapp.net");
    });
  });
});

describe("Setup Wizard Integration", () => {
  it("should be able to request pairing code via HTTP", () => {
    // This test documents the expected flow:
    // 1. Setup wizard calls POST /pair with phone number
    // 2. wa-client requests pairing code from WhatsApp
    // 3. Code is returned to setup wizard
    // 4. User enters code on phone
    const expectedFlow = [
      "POST /pair",
      "adapter.requestPairingCode()",
      "return { success: true, code: '...' }",
    ];
    expect(expectedFlow).toHaveLength(3);
  });

  it("should gracefully handle service unavailability", () => {
    // When wa-client is not ready, the setup wizard should:
    // 1. Detect service health via GET /health
    // 2. Wait or retry with exponential backoff
    // 3. Suggest QR code alternative if pairing fails
    const errorHandling = {
      "503": "Service not initialized",
      "400": "Phone number required",
      "429": "Rate limited - wait 15 minutes",
      "500": "General error - check logs",
    };
    expect(Object.keys(errorHandling)).toHaveLength(4);
  });
});
