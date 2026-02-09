import { controlPlaneFetchJson } from "@/lib/control-plane-server";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import {
  type ControlPlaneScanRow,
  mapScanRow,
} from "@/lib/control-plane-mappers";
import type { ScanVerdict } from "@/lib/api";

function isValidCursor(raw: string): boolean {
  if (raw.trim().length === 0) return false;
  if (raw.length > 512) return false;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== "object") return false;
    const obj = parsed as { ts?: unknown; id?: unknown };

    const ts = typeof obj.ts === "string" ? obj.ts.trim() : "";
    if (!ts) return false;
    const parsedDate = new Date(ts);
    if (Number.isNaN(parsedDate.getTime())) return false;

    const parsedId = Number.parseInt(String(obj.id ?? ""), 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) return false;

    return true;
  } catch {
    return false;
  }
}

function makeCursor(item: Pick<ScanVerdict, "timestamp" | "id">): string {
  return Buffer.from(
    JSON.stringify({ ts: item.timestamp, id: item.id }),
    "utf8",
  ).toString("base64url");
}

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const encoder = new TextEncoder();
  const lastEventId = req.headers.get("last-event-id");
  const initialAfter =
    typeof lastEventId === "string" && isValidCursor(lastEventId)
      ? lastEventId
      : null;

  let closed = false;
  let streamController: ReadableStreamDefaultController | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

  const cleanup = (controller?: ReadableStreamDefaultController) => {
    const target = controller ?? streamController;
    streamController = null;
    if (!closed) {
      closed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (pingInterval) clearInterval(pingInterval);
      if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
      pollInterval = null;
      pingInterval = null;
      autoCloseTimeout = null;
    }

    if (target) {
      try {
        target.close();
      } catch {
        // Ignore close races.
      }
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      streamController = controller;
      let afterCursor: string | null = initialAfter;

      const safeEnqueue = (chunk: Uint8Array) => {
        const target = streamController;
        if (closed || !target) return;
        try {
          target.enqueue(chunk);
        } catch {
          cleanup(target);
        }
      };

      const send = (data: unknown) => {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const sendWithId = (id: string, data: unknown) => {
        safeEnqueue(
          encoder.encode(`id: ${id}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const ping = () => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      };

      // Initial connection message (helps client distinguish connect vs. no-data)
      send({ type: "connected" });

      const fetchRecent = async (): Promise<ScanVerdict[]> => {
        const params = new URLSearchParams({ limit: "25" });
        if (afterCursor) params.set("after", afterCursor);
        const rows = await controlPlaneFetchJson<ControlPlaneScanRow[]>(
          `/scans/recent?${params.toString()}`,
          { timeoutMs: 6000, authToken: auth.session.controlPlaneToken },
        );
        return rows.map(mapScanRow);
      };

      const sendScan = (item: ScanVerdict) => {
        const cursor = makeCursor(item);
        afterCursor = cursor;
        sendWithId(cursor, item);
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
            sendScan(item);
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
          const fresh = items.sort((a, b) => {
            const ts = a.timestamp.localeCompare(b.timestamp);
            if (ts !== 0) return ts;
            return a.id.localeCompare(b.id);
          });

          for (const item of fresh) {
            if (closed) return;
            sendScan(item);
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
