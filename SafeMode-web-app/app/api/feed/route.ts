import { controlPlaneFetchJson } from "@/lib/control-plane-server";
import {
  mapScanRow,
  type ControlPlaneScanRow,
} from "@/lib/control-plane-mappers";
import type { ScanVerdict } from "@/lib/api";

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

  const cleanup = (controller?: ReadableStreamDefaultController) => {
    if (closed) return;
    closed = true;
    if (pollInterval) clearInterval(pollInterval);
    if (pingInterval) clearInterval(pingInterval);
    if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
    pollInterval = null;
    pingInterval = null;
    autoCloseTimeout = null;
    if (controller) {
      try {
        controller.close();
      } catch {
        // Ignore close races.
      }
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          cleanup(controller);
        }
      };

      const send = (data: unknown) => {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const ping = () => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      };

      // Initial connection message (helps client distinguish connect vs. no-data)
      send({ type: "connected" });

      const sentIds = new Set<string>();
      const sentQueue: string[] = [];
      const rememberId = (id: string) => {
        if (sentIds.has(id)) return;
        sentIds.add(id);
        sentQueue.push(id);
        if (sentQueue.length > 500) {
          const oldest = sentQueue.shift();
          if (oldest) sentIds.delete(oldest);
        }
      };

      const fetchRecent = async (): Promise<ScanVerdict[]> => {
        const rows = await controlPlaneFetchJson<ControlPlaneScanRow[]>(
          "/scans/recent?limit=25",
          { timeoutMs: 6000 },
        );
        return rows.map(mapScanRow);
      };

      const seed = async () => {
        try {
          const items = await fetchRecent();
          const sorted = [...items].sort((a, b) => {
            const ts = a.timestamp.localeCompare(b.timestamp);
            if (ts !== 0) return ts;
            return a.id.localeCompare(b.id);
          });
          for (const item of sorted) {
            if (closed) return;
            if (sentIds.has(item.id)) continue;
            send(item);
            rememberId(item.id);
          }
        } catch {
          // If seeding fails, keep the connection open so clients can retry.
        }
      };

      await seed();

      let isPolling = false;

      pollInterval = setInterval(async () => {
        if (closed || isPolling) return;
        isPolling = true;
        try {
          const items = await fetchRecent();
          const fresh = items
            .filter((item) => !sentIds.has(item.id))
            .sort((a, b) => {
              const ts = a.timestamp.localeCompare(b.timestamp);
              if (ts !== 0) return ts;
              return a.id.localeCompare(b.id);
            });

          for (const item of fresh) {
            if (closed) return;
            send(item);
            rememberId(item.id);
          }
        } catch {
          // Allow transient failures and keep the SSE connection alive.
        } finally {
          isPolling = false;
        }
      }, 5000);

      pingInterval = setInterval(() => {
        ping();
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
