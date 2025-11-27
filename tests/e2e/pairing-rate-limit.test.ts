import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { PairingOrchestrator } from "../../services/wa-client/src/pairingOrchestrator";

describe("RemoteAuth pairing orchestrator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("backs off to 60 seconds after rate limit errors to avoid hammering WhatsApp", async () => {
    const callTimestamps: number[] = [];
    let attemptCounter = 0;
    const requestCode = vi.fn(async () => {
      callTimestamps.push(Date.now());
      attemptCounter += 1;
      if (attemptCounter < 3) {
        throw new Error(
          'pairing_code_request_failed:{"type":"IQErrorRateOverlimit","value":{"code":429}}',
        );
      }
      return "123456";
    });
    const orchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: false,
      maxAttempts: 5,
      baseRetryDelayMs: 15000,
      rateLimitDelayMs: 60000,
      requestCode,
      onError: () => undefined,
    });

    orchestrator.schedule(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(requestCode).toHaveBeenCalledTimes(1);
    expect(callTimestamps[0]).toBe(0);

    await vi.advanceTimersByTimeAsync(59000);
    expect(requestCode).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(requestCode).toHaveBeenCalledTimes(2);
    expect(callTimestamps[1]).toBe(60000);

    await vi.advanceTimersByTimeAsync(59000);
    expect(requestCode).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(requestCode).toHaveBeenCalledTimes(3);
    expect(callTimestamps[2]).toBe(120000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("invokes fallback and stops retrying after exhausting attempts", async () => {
    const fallback = vi.fn();
    const requestCode = vi.fn(async () => {
      throw new Error('pairing_code_request_failed:{"reason":"other"}');
    });
    const orchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: false,
      maxAttempts: 2,
      baseRetryDelayMs: 1000,
      rateLimitDelayMs: 60000,
      requestCode,
      onError: () => undefined,
      onFallback: fallback,
    });

    orchestrator.schedule(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(requestCode).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(requestCode).toHaveBeenCalledTimes(2);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
