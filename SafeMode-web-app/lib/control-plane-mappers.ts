import "server-only";

import type { ScanVerdict } from "@/lib/api";

export type ControlPlaneScanRow = {
  id: number | string;
  url_hash: string;
  normalized_url: string;
  verdict: "benign" | "suspicious" | "malicious";
  last_seen_at: string;
};

export function mapVerdictLevel(
  verdict: string,
): ScanVerdict["verdict"] {
  switch (verdict) {
    case "malicious":
      return "DENY";
    case "suspicious":
      return "WARN";
    case "benign":
      return "SAFE";
    default:
      console.warn("Unknown control-plane verdict", { verdict });
      return "WARN";
  }
}

/**
* Shared mapping from control-plane scan rows to the public `ScanVerdict` payload used by
* both the SSE feed and `/api/scans/recent` endpoints.
*/
export function mapScanRow(row: ControlPlaneScanRow): ScanVerdict {
  return {
    id: String(row.id),
    urlHash: row.url_hash,
    timestamp: row.last_seen_at,
    url: row.normalized_url,
    verdict: mapVerdictLevel(row.verdict),
  };
}
