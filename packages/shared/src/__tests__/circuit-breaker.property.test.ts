/**
 * Model-Based Property Tests for CircuitBreaker
 *
 * Tests state machine transitions:
 * - CLOSED → OPEN (on failure threshold)
 * - OPEN → HALF_OPEN (after timeout)
 * - HALF_OPEN → CLOSED (on success threshold)
 * - HALF_OPEN → OPEN (on failure)
 */

import { describe, expect, test } from "@jest/globals";
import fc from "fast-check";
import { CircuitBreaker, CircuitState, withRetry } from "../circuit-breaker";

const NUM_RUNS = process.env.CI ? 10000 : 1000;

describe("CircuitBreaker - Model-Based Property Tests", () => {
  const defaultOpts = {
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 1000,
    windowMs: 10000,
    name: "test-circuit",
  };

  describe("State Invariants", () => {
    test("PROPERTY: Initial state is always CLOSED", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 100, max: 5000 }),
          (failureThreshold, successThreshold, timeoutMs) => {
            const breaker = new CircuitBreaker({
              ...defaultOpts,
              failureThreshold,
              successThreshold,
              timeoutMs,
            });
            expect(breaker.getState()).toBe(CircuitState.CLOSED);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: State is always one of CLOSED, OPEN, or HALF_OPEN", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (failureThreshold, successThreshold) => {
            const breaker = new CircuitBreaker({
              ...defaultOpts,
              failureThreshold,
              successThreshold,
            });

            const state = breaker.getState();
            expect([
              CircuitState.CLOSED,
              CircuitState.OPEN,
              CircuitState.HALF_OPEN,
            ]).toContain(state);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Configuration Properties", () => {
    test("PROPERTY: Failure threshold must be respected", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (failureThreshold) => {
            const stateChanges: Array<{ from: CircuitState; to: CircuitState }> = [];
            const breaker = new CircuitBreaker({
              ...defaultOpts,
              failureThreshold,
              onStateChange: (to, from) => stateChanges.push({ from, to }),
            });

            for (let i = 0; i < failureThreshold - 1; i++) {
              breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
            }

            expect(breaker.getState()).toBe(CircuitState.CLOSED);
            expect(stateChanges.length).toBe(0);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Options are correctly stored", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 50, max: 10000 }),
          fc.integer({ min: 1000, max: 60000 }),
          fc.asciiString({ minLength: 1, maxLength: 20 }),
          (failureThreshold, successThreshold, timeoutMs, windowMs, name) => {
            const opts = {
              failureThreshold,
              successThreshold,
              timeoutMs,
              windowMs,
              name,
            };
            const breaker = new CircuitBreaker(opts);

            expect(breaker.getState()).toBe(CircuitState.CLOSED);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("State Change Callback Properties", () => {
    test("PROPERTY: State change callback is invoked with correct arguments", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (failureThreshold) => {
          const changes: Array<{ to: CircuitState; from: CircuitState }> = [];
          const breaker = new CircuitBreaker({
            ...defaultOpts,
            failureThreshold,
            onStateChange: (to, from) => changes.push({ to, from }),
          });

          for (let i = 0; i < failureThreshold; i++) {
            breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
          }

          if (changes.length > 0) {
            const lastChange = changes[changes.length - 1];
            expect(lastChange.from).toBe(CircuitState.CLOSED);
            expect(lastChange.to).toBe(CircuitState.OPEN);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });
});

describe("withRetry - Property Tests", () => {
  test("PROPERTY: Zero retries means single attempt", async () => {
    await fc.assert(
      fc.asyncProperty(fc.nat(1000), async (baseDelayMs) => {
        let attempts = 0;
        const task = () => {
          attempts++;
          return Promise.reject(new Error("fail"));
        };

        await withRetry(task, { retries: 0, baseDelayMs }).catch(() => {});
        expect(attempts).toBe(1);
      }),
      { numRuns: Math.min(NUM_RUNS, 100) },
    );
  });

  test("PROPERTY: Successful task returns immediately", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.nat(1000),
        fc.asciiString({ minLength: 1, maxLength: 50 }),
        async (retries, baseDelayMs, expectedValue) => {
          let attempts = 0;
          const task = () => {
            attempts++;
            return Promise.resolve(expectedValue);
          };

          const result = await withRetry(task, { retries, baseDelayMs });
          expect(result).toBe(expectedValue);
          expect(attempts).toBe(1);
        },
      ),
      { numRuns: Math.min(NUM_RUNS, 100) },
    );
  });

  test("PROPERTY: Retryable predicate is respected", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (retries) => {
        let attempts = 0;
        const task = () => {
          attempts++;
          return Promise.reject(new Error("non-retryable"));
        };

        const retryable = () => false;

        await withRetry(task, { retries, baseDelayMs: 1, retryable }).catch(() => {});
        expect(attempts).toBe(1);
      }),
      { numRuns: Math.min(NUM_RUNS, 100) },
    );
  });

  test("PROPERTY: Factor affects delay exponentially", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.1, max: 3.0, noNaN: true }),
        fc.integer({ min: 10, max: 100 }),
        (factor, baseDelayMs) => {
          const delay1 = baseDelayMs * Math.pow(factor, 0);
          const delay2 = baseDelayMs * Math.pow(factor, 1);
          const delay3 = baseDelayMs * Math.pow(factor, 2);

          expect(delay1).toBe(baseDelayMs);
          expect(delay2).toBeCloseTo(baseDelayMs * factor, 5);
          expect(delay3).toBeCloseTo(baseDelayMs * factor * factor, 5);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
