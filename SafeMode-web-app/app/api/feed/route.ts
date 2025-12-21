import { controlPlaneFetchJson } from "@/lib/control-plane-server";
import type { ScanVerdict } from "@/lib/api";

type ControlPlaneScanRow = {
  id: number | string;
  url_hash: string;
  normalized_url: string;
  verdict: "benign" | "suspicious" | "malicious";
  last_seen_at: string | Date;
};

function mapVerdictLevel(
  verdict: ControlPlaneScanRow["verdict"],
): ScanVerdict["verdict"] {
  if (verdict === "malicious") return "DENY";
  if (verdict === "suspicious") return "WARN";
  return "SAFE";
}

function mapRow(row: ControlPlaneScanRow): ScanVerdict {
  return {
    id: String(row.id),
    urlHash: row.url_hash,
    timestamp:
      row.last_seen_at instanceof Date
        ? row.last_seen_at.toISOString()
        : String(row.last_seen_at),
    url: row.normalized_url,
    verdict: mapVerdictLevel(row.verdict),
  };
}

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

  const cleanup = (controller?: ReadableStreamDefaultController) => {
    closed = true;
    if (pollInterval) clearInterval(pollInterval);
    if (pingInterval) clearInterval(pingInterval);
    if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
    pollInterval = null;
    pingInterval = null;
    autoCloseTimeout = null;
    if (controller) {
      controller.close();
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      const ping = () => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      };

      // Initial connection message (helps client distinguish connect vs. no-data)
      send({ type: "connected" });

      let lastSeenId = 0;

      const fetchRecent = async (): Promise<ScanVerdict[]> => {
        const rows = await controlPlaneFetchJson<ControlPlaneScanRow[]>(
          "/scans/recent?limit=25",
          { timeoutMs: 6000 },
        );
        return rows.map(mapRow);
      };

      const seed = async () => {
        try {
          const items = await fetchRecent();
          const sorted = [...items].sort(
            (a, b) => Number(a.id) - Number(b.id),
          );
          for (const item of sorted) {
            if (closed) return;
            send(item);
            const id = Number(item.id);
            if (Number.isFinite(id)) {
              lastSeenId = Math.max(lastSeenId, id);
            }
          }
        } catch {
          // If seeding fails, keep the connection open so clients can retry.
        }
      };

      await seed();

      pollInterval = setInterval(async () => {
        try {
          const items = await fetchRecent();
          const fresh = items
            .filter((item) => {
              const id = Number(item.id);
              return Number.isFinite(id) && id > lastSeenId;
            })
            .sort((a, b) => Number(a.id) - Number(b.id));

          for (const item of fresh) {
            if (closed) return;
            send(item);
            lastSeenId = Math.max(lastSeenId, Number(item.id));
          }
        } catch {
          // Allow transient failures and keep the SSE connection alive.
        }
      }, 5000);

      pingInterval = setInterval(() => {
        try {
          ping();
        } catch {
          cleanup(controller);
        }
      }, 30000);

      // Auto-close after 5 minutes to avoid leaking long-lived streams.
      autoCloseTimeout = setTimeout(() => {
        cleanup(controller);
      }, 300000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
