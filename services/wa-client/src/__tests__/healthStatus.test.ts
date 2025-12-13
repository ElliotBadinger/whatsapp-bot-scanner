import { describe, it, expect } from "@jest/globals";
import { computeWaHealthStatus } from "../healthStatus";

describe("computeWaHealthStatus", () => {
  it("returns healthy when state is ready", () => {
    expect(computeWaHealthStatus({ state: "ready", qrAvailable: false })).toBe(
      "healthy",
    );
  });

  it("returns healthy when state is connecting and QR is available", () => {
    expect(
      computeWaHealthStatus({ state: "connecting", qrAvailable: true }),
    ).toBe("healthy");
  });

  it("returns degraded when state is connecting but QR is not available", () => {
    expect(
      computeWaHealthStatus({ state: "connecting", qrAvailable: false }),
    ).toBe("degraded");
  });

  it("returns degraded for other states", () => {
    expect(
      computeWaHealthStatus({ state: "disconnected", qrAvailable: true }),
    ).toBe("degraded");
    expect(computeWaHealthStatus({ state: "unknown", qrAvailable: true })).toBe(
      "degraded",
    );
  });
});
