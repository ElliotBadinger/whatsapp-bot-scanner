import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker, CircuitState } from "@wbscanner/shared";

describe("Circuit breaker transitions", () => {
  it("transitions through open, half-open, and closed states", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    const transitions: Array<{ to: CircuitState; from: CircuitState }> = [];

    const breaker = new CircuitBreaker({
      name: "test",
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 1000,
      windowMs: 10_000,
      onStateChange: (state, from) => transitions.push({ to: state, from }),
    });

    await expect(
      breaker.execute(async () => {
        throw new Error("first failure");
      }),
    ).rejects.toThrow("first failure");

    await expect(
      breaker.execute(async () => {
        throw new Error("second failure");
      }),
    ).rejects.toThrow("second failure");

    expect(transitions).toContainEqual({
      to: CircuitState.OPEN,
      from: CircuitState.CLOSED,
    });

    await expect(
      breaker.execute(async () => {
        return "should not run";
      }),
    ).rejects.toThrow(/Circuit test is open/);

    vi.advanceTimersByTime(1001);

    const result = await breaker.execute(async () => "ok");
    expect(result).toBe("ok");

    expect(transitions).toContainEqual({
      to: CircuitState.HALF_OPEN,
      from: CircuitState.OPEN,
    });
    expect(transitions).toContainEqual({
      to: CircuitState.CLOSED,
      from: CircuitState.HALF_OPEN,
    });

    vi.useRealTimers();
  });
});
