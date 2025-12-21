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
  verdict: ControlPlaneScanRow["verdict"],
): ScanVerdict["verdict"] {
  if (verdict === "malicious") return "DENY";
  if (verdict === "suspicious") return "WARN";
  return "SAFE";
}

export function mapScanRow(row: ControlPlaneScanRow): ScanVerdict {
  return {
    id: String(row.id),
    urlHash: row.url_hash,
    timestamp: row.last_seen_at,
    url: row.normalized_url,
    verdict: mapVerdictLevel(row.verdict),
  };
}
