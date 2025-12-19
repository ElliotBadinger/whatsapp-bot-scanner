import { CircuitBreaker, CircuitState, withRetry } from "../circuit-breaker";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("transitions to open after failures and recovers after timeout", async () => {
    const breaker = new CircuitBreaker({
      name: "test-service",
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 1000,
      windowMs: 1000,
    });

    await expect(
      breaker.execute(async () => {
        throw Object.assign(new Error("fail"), { statusCode: 500 });
      }),
    ).rejects.toThrow("fail");

    await expect(
      breaker.execute(async () => {
        throw Object.assign(new Error("fail"), { statusCode: 500 });
      }),
    ).rejects.toThrow("fail");

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await expect(breaker.execute(async () => "ok")).rejects.toThrow(
      "Circuit test-service is open",
    );

    jest.advanceTimersByTime(1001);

    const result = await breaker.execute(async () => "ok");
    expect(result).toBe("ok");
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("keeps circuit open when half-open probe fails", async () => {
    const breaker = new CircuitBreaker({
      name: "probe-service",
      failureThreshold: 1,
      successThreshold: 2,
      timeoutMs: 500,
      windowMs: 1000,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(600);

    await expect(
      breaker.execute(async () => {
        throw new Error("probe failure");
      }),
    ).rejects.toThrow("probe failure");
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(600);
    const successOne = await breaker.execute(async () => "first");
    expect(successOne).toBe("first");
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    const successTwo = await breaker.execute(async () => "second");
    expect(successTwo).toBe("second");
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });
});

describe("CircuitBreaker mutation boundary tests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens exactly at failureThreshold (boundary test)", async () => {
    const breaker = new CircuitBreaker({
      name: "boundary-test",
      failureThreshold: 3,
      successThreshold: 1,
      timeoutMs: 1000,
      windowMs: 5000,
    });

    // 1st failure - should stay closed
    await expect(
      breaker.execute(async () => {
        throw new Error("fail1");
      }),
    ).rejects.toThrow("fail1");
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // 2nd failure - should stay closed
    await expect(
      breaker.execute(async () => {
        throw new Error("fail2");
      }),
    ).rejects.toThrow("fail2");
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // 3rd failure - should NOW open (>= threshold, not > threshold)
    await expect(
      breaker.execute(async () => {
        throw new Error("fail3");
      }),
    ).rejects.toThrow("fail3");
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it("recovery uses elapsed time correctly (Date.now() - lastFailure)", async () => {
    const breaker = new CircuitBreaker({
      name: "recovery-test",
      failureThreshold: 1,
      successThreshold: 1,
      timeoutMs: 1000,
      windowMs: 5000,
    });

    // Trigger circuit open
    await expect(
      breaker.execute(async () => {
        throw new Error("trigger");
      }),
    ).rejects.toThrow("trigger");
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Advance time by 500ms - still open (less than timeoutMs)
    jest.advanceTimersByTime(500);
    await expect(breaker.execute(async () => "should-fail")).rejects.toThrow(
      "Circuit recovery-test is open",
    );

    // Advance time by another 501ms (total 1001ms) - should allow probe
    jest.advanceTimersByTime(501);
    const result = await breaker.execute(async () => "recovered");
    expect(result).toBe("recovered");
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });
});

describe("withRetry", () => {
  it("retries retryable errors with exponential backoff", async () => {
    jest.useRealTimers();
    const calls: number[] = [];
    const task = jest.fn(async () => {
      calls.push(Date.now());
      throw Object.assign(new Error("temporary"), { statusCode: 500 });
    });

    const promise = withRetry(task, {
      retries: 2,
      baseDelayMs: 5,
      factor: 1,
      retryable: (err) => (err as any)?.statusCode >= 500,
    });

    await expect(promise).rejects.toThrow("temporary");
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("stops retrying when predicate returns false", async () => {
    jest.useRealTimers();
    const task = jest.fn(async () => {
      throw Object.assign(new Error("no-retry"), { statusCode: 400 });
    });

    await expect(
      withRetry(task, {
        retries: 3,
        baseDelayMs: 5,
        retryable: (err) => (err as any)?.statusCode >= 500,
      }),
    ).rejects.toThrow("no-retry");
    expect(task).toHaveBeenCalledTimes(1);
  });
});
