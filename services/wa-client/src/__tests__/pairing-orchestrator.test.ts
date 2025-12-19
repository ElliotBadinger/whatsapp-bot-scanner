import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { PairingOrchestrator } from "../pairingOrchestrator";

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe("PairingOrchestrator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("schedules and succeeds with a pairing code", async () => {
    const scheduled: Array<() => void> = [];
    const scheduler = (fn: () => void) => {
      scheduled.push(fn);
      return {} as any;
    };
    const onSuccess = jest.fn();

    const orchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: false,
      maxAttempts: 2,
      baseRetryDelayMs: 1000,
      rateLimitDelayMs: 5000,
      requestCode: jest.fn().mockResolvedValue("CODE-123"),
      onSuccess,
      scheduler,
      clearer: jest.fn(),
    });

    orchestrator.schedule(0);
    scheduled[0]();
    await flushPromises();

    expect(onSuccess).toHaveBeenCalledWith("CODE-123", 1);
    expect(orchestrator.getStatus().rateLimited).toBe(false);
  });

  it("marks rate limit errors and enforces cooldowns", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);
    const scheduled: Array<() => void> = [];
    const scheduler = (fn: () => void) => {
      scheduled.push(fn);
      return {} as any;
    };
    const onError = jest.fn();

    const orchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: false,
      maxAttempts: 2,
      baseRetryDelayMs: 1000,
      rateLimitDelayMs: 5000,
      requestCode: jest
        .fn()
        .mockRejectedValue(
          'pairing_code_request_failed:{"type":"IQErrorRateOverlimit","value":{"code":429}}',
        ),
      onError,
      scheduler,
      clearer: jest.fn(),
    });

    orchestrator.schedule(0);
    scheduled[0]();
    await flushPromises();

    expect(onError).toHaveBeenCalled();
    const meta = onError.mock.calls[0][3] as { rateLimited: boolean };
    expect(meta.rateLimited).toBe(true);
    expect(orchestrator.getRemainingCooldown()).toBe(5000);
    expect(orchestrator.getStatus().rateLimited).toBe(true);
    nowSpy.mockRestore();
  });

  it("supports manual-only scheduling", async () => {
    const scheduled: Array<() => void> = [];
    const scheduler = (fn: () => void) => {
      scheduled.push(fn);
      return {} as any;
    };

    const orchestrator = new PairingOrchestrator({
      enabled: true,
      manualOnly: true,
      forcePhonePairing: false,
      maxAttempts: 1,
      baseRetryDelayMs: 1000,
      rateLimitDelayMs: 5000,
      requestCode: jest.fn().mockResolvedValue("CODE-456"),
      scheduler,
      clearer: jest.fn(),
    });

    expect(orchestrator.requestManually()).toBe(true);
    expect(scheduled.length).toBe(1);

    await orchestrator.setSessionActive(true);
    expect(orchestrator.requestManually()).toBe(false);
  });

  it("falls back when max attempts exceeded without force pairing", async () => {
    const scheduled: Array<() => void> = [];
    const scheduler = (fn: () => void) => {
      scheduled.push(fn);
      return {} as any;
    };
    const onFallback = jest.fn();
    const onForcedRetry = jest.fn();

    const orchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: false,
      maxAttempts: 1,
      baseRetryDelayMs: 1000,
      rateLimitDelayMs: 5000,
      requestCode: jest.fn().mockRejectedValue(new Error("boom")),
      onFallback,
      onForcedRetry,
      scheduler,
      clearer: jest.fn(),
    });

    orchestrator.schedule(0);
    scheduled[0]();
    await flushPromises();

    expect(onFallback).toHaveBeenCalled();
    expect(onForcedRetry).not.toHaveBeenCalled();
  });

  it("forces retry scheduling when configured", async () => {
    const scheduled: Array<() => void> = [];
    const scheduler = (fn: () => void) => {
      scheduled.push(fn);
      return {} as any;
    };
    const onForcedRetry = jest.fn();

    const orchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: true,
      maxAttempts: 1,
      baseRetryDelayMs: 1000,
      rateLimitDelayMs: 5000,
      requestCode: jest.fn().mockRejectedValue(new Error("rate-overlimit")),
      onForcedRetry,
      scheduler,
      clearer: jest.fn(),
    });

    orchestrator.schedule(0);
    scheduled[0]();
    await flushPromises();

    expect(onForcedRetry).toHaveBeenCalled();
    expect(scheduled.length).toBe(2);
  });
});
