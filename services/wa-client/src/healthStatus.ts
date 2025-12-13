export type WaHealthStatus = "healthy" | "degraded";

export function computeWaHealthStatus(input: {
  state: string;
  qrAvailable: boolean;
}): WaHealthStatus {
  if (input.state === "ready") {
    return "healthy";
  }

  if (input.state === "connecting" && input.qrAvailable) {
    return "healthy";
  }

  return "degraded";
}
