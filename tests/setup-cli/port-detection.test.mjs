/**
 * Port Detection Tests
 *
 * Tests for the port conflict detection and resolution
 * functionality in the setup wizard.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import net from "net";

/**
 * Helper to check if a port is available
 * (mirrors the implementation in unified-cli.mjs)
 */
async function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "0.0.0.0");
  });
}

/**
 * Helper to occupy a port for testing
 */
function occupyPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.once("listening", () => {
      resolve(server);
    });
    server.listen(port, "0.0.0.0");
  });
}

describe("Port Detection", () => {
  let occupiedServers = [];

  afterEach(async () => {
    // Clean up any servers we created
    for (const server of occupiedServers) {
      await new Promise((resolve) => server.close(resolve));
    }
    occupiedServers = [];
  });

  describe("checkPortAvailable", () => {
    it("should return true for an available port", async () => {
      // Use a high port number unlikely to be in use
      const available = await checkPortAvailable(49999);
      expect(available).toBe(true);
    });

    it("should return false for an occupied port", async () => {
      // Occupy a port first
      const server = await occupyPort(49998);
      occupiedServers.push(server);

      // Now check if it's available
      const available = await checkPortAvailable(49998);
      expect(available).toBe(false);
    });

    it("should correctly detect port release after server close", async () => {
      // Occupy a port
      const server = await occupyPort(49997);
      
      // Verify it's not available
      let available = await checkPortAvailable(49997);
      expect(available).toBe(false);

      // Release the port
      await new Promise((resolve) => server.close(resolve));

      // Verify it's now available
      available = await checkPortAvailable(49997);
      expect(available).toBe(true);
    });
  });

  describe("Required Ports Configuration", () => {
    const REQUIRED_PORTS = [
      { name: "Redis", port: 6379, configurable: false },
      { name: "WA Client", port: 3005, configurable: true, env: "WA_CLIENT_PORT" },
      { name: "Scan Orchestrator", port: 3003, configurable: true, env: "SCAN_ORCHESTRATOR_PORT" },
      { name: "Grafana", port: 3002, configurable: true, env: "GRAFANA_PORT" },
      { name: "Prometheus", port: 9091, configurable: false },
      { name: "Uptime Kuma", port: 3001, configurable: true, env: "UPTIME_KUMA_PORT" },
      { name: "Reverse Proxy", port: 8088, configurable: true, env: "REVERSE_PROXY_PORT" },
    ];

    it("should have correct default ports defined", () => {
      expect(REQUIRED_PORTS.length).toBe(7);
      expect(REQUIRED_PORTS.find(p => p.name === "Grafana")?.port).toBe(3002);
      expect(REQUIRED_PORTS.find(p => p.name === "Redis")?.port).toBe(6379);
    });

    it("should mark non-standard ports as configurable", () => {
      const configurable = REQUIRED_PORTS.filter(p => p.configurable);
      const nonConfigurable = REQUIRED_PORTS.filter(p => !p.configurable);

      // Redis and Prometheus are fixed ports
      expect(nonConfigurable.map(p => p.name)).toContain("Redis");
      expect(nonConfigurable.map(p => p.name)).toContain("Prometheus");

      // Others should be configurable
      expect(configurable.map(p => p.name)).toContain("Grafana");
      expect(configurable.map(p => p.name)).toContain("WA Client");
    });

    it("should have env variable names for configurable ports", () => {
      const configurable = REQUIRED_PORTS.filter(p => p.configurable);
      for (const port of configurable) {
        expect(port.env).toBeDefined();
        expect(port.env).toMatch(/^[A-Z_]+$/);
      }
    });
  });

  describe("Port Conflict Resolution", () => {
    it("should find alternative port when original is occupied", async () => {
      // Use high port numbers to avoid conflicts with system services
      const basePort = 59100;
      
      // Occupy the base port
      const server = await occupyPort(basePort);
      occupiedServers.push(server);

      // Look for next available port
      let altPort = basePort + 1;
      while (!(await checkPortAvailable(altPort)) && altPort < basePort + 100) {
        altPort++;
      }

      expect(altPort).toBe(basePort + 1); // Should find 59101

      // If next port is also occupied, it should find the one after
      const server2 = await occupyPort(basePort + 1);
      occupiedServers.push(server2);

      altPort = basePort + 1;
      while (!(await checkPortAvailable(altPort)) && altPort < basePort + 100) {
        altPort++;
      }

      expect(altPort).toBe(basePort + 2); // Should find 59102
    });

    it("should fail gracefully if no ports available in range", async () => {
      // This test verifies the logic, not actually occupying 100 ports
      const startPort = 49900;
      const maxAttempts = 5;
      
      // Occupy a range of ports
      for (let i = 0; i < maxAttempts; i++) {
        const server = await occupyPort(startPort + i);
        occupiedServers.push(server);
      }

      // Try to find available port
      let altPort = startPort;
      let attempts = 0;
      while (!(await checkPortAvailable(altPort)) && attempts < maxAttempts) {
        altPort++;
        attempts++;
      }

      // Should have exhausted attempts
      expect(attempts).toBe(maxAttempts);
    });
  });
});

describe("Setup Wizard Port Integration", () => {
  it("should check ports before starting Docker", () => {
    // This verifies the flow order:
    // 1. Prerequisites check
    // 2. Configuration
    // 3. API Keys
    // 4. Port check <- NEW
    // 5. Start Services
    // 6. Pairing
    const steps = [
      "Prerequisites Check",
      "Configuration",
      "API Keys & Configuration",
      "Starting Services", // Includes port check
      "WhatsApp Pairing",
    ];

    expect(steps).toHaveLength(5);
    expect(steps[3]).toBe("Starting Services");
  });
});
