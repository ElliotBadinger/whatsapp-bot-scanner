import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { PairingOrchestrator, PairingErrorInfo } from "../pairingOrchestrator";

// Mock timers
jest.useFakeTimers();

describe("PairingOrchestrator", () => {
  let orchestrator: PairingOrchestrator;
  let mockRequestCode: jest.Mock<() => Promise<string>>;
  let mockOnSuccess: jest.Mock<(code: string, attempt: number) => void>;
  let mockOnError: jest.Mock<
    (
      err: unknown,
      attempt: number,
      nextDelayMs: number,
      meta: { rateLimited: boolean; holdUntil?: number },
      errorInfo?: PairingErrorInfo,
    ) => void
  >;
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    mockRequestCode = jest.fn<() => Promise<string>>();
    mockOnSuccess = jest.fn<(code: string, attempt: number) => void>();
    mockOnError =
      jest.fn<
        (
          err: unknown,
          attempt: number,
          nextDelayMs: number,
          meta: { rateLimited: boolean; holdUntil?: number },
          errorInfo?: PairingErrorInfo,
        ) => void
      >();
    mockStorage = new Map();

    orchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: true,
      maxAttempts: 3,
      baseRetryDelayMs: 1000,
      rateLimitDelayMs: 5000,
      requestCode: mockRequestCode,
      onSuccess: mockOnSuccess,
      onError: mockOnError,
      storage: {
        get: async () => mockStorage.get("key") ?? null,
        set: async (val) => {
          mockStorage.set("key", val);
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
  });

  it("Scenario A: Success flow", async () => {
    mockRequestCode.mockResolvedValue("ABC-123");

    orchestrator.schedule(0);
    await jest.runAllTimersAsync();

    expect(mockRequestCode).toHaveBeenCalledTimes(1);
    expect(mockOnSuccess).toHaveBeenCalledWith("ABC-123", 1);

    // Wait for async saveState to complete
    await Promise.resolve();
    expect(mockStorage.get("key")).toBe("0"); // Should clear backoff
  });

  it("Scenario B: DOM not ready (retries)", async () => {
    // Fail twice, then succeed
    mockRequestCode
      .mockRejectedValueOnce(new Error("AuthStore undefined"))
      .mockRejectedValueOnce(new Error("AuthStore undefined"))
      .mockResolvedValue("XYZ-789");

    orchestrator.schedule(0);

    // First attempt (immediate, delay=0)
    await jest.advanceTimersByTimeAsync(0);
    expect(mockRequestCode).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledTimes(1);

    // Second attempt (after baseRetryDelayMs=1000)
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockRequestCode).toHaveBeenCalledTimes(2);

    // Third attempt (after exponential backoff ~2000ms)
    await jest.advanceTimersByTimeAsync(2000);
    expect(mockRequestCode).toHaveBeenCalledTimes(3);
    expect(mockOnSuccess).toHaveBeenCalledWith("XYZ-789", 3);
  });

  it("Scenario C: Rate Limited", async () => {
    const rateLimitError = new Error(
      "pairing_code_request_failed:rate-overlimit:{}",
    );
    mockRequestCode.mockRejectedValueOnce(rateLimitError);

    orchestrator.schedule(0);
    // Only advance enough for the first attempt
    await jest.advanceTimersByTimeAsync(0);

    expect(mockRequestCode).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledTimes(1);

    // Check if backoff was persisted
    const storedBackoff = Number(mockStorage.get("key"));
    expect(storedBackoff).toBeGreaterThan(Date.now());

    const errorInfo = mockOnError.mock.calls[0][4] as PairingErrorInfo;
    expect(errorInfo.type).toBe("rate_limit");
  });

  it("should respect persisted backoff on restart", async () => {
    // Simulate existing backoff in storage
    const futureTime = Date.now() + 10000;
    mockStorage.set("key", String(futureTime));

    // Re-instantiate orchestrator
    const newOrchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: true,
      maxAttempts: 3,
      baseRetryDelayMs: 1000,
      rateLimitDelayMs: 5000,
      requestCode: mockRequestCode,
      storage: {
        get: async () => mockStorage.get("key") ?? null,
        set: async (val) => {
          mockStorage.set("key", val);
        },
      },
    });

    // Must call init() to load persisted state
    await newOrchestrator.init();

    const status = newOrchestrator.getStatus();
    expect(status.nextAttemptIn).toBeGreaterThan(0);
    expect(status.canRequest).toBe(false);
  });
});
