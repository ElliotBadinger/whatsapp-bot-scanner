"use client";

import { useEffect, useState, useCallback, memo, useRef } from "react";
import type { ScanVerdict } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LiveFeedProps {
  maxItems?: number;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const VERDICT_STYLES = {
  SAFE: { text: "text-success", bg: "bg-success/10" },
  DENY: { text: "text-danger", bg: "bg-danger/10" },
  WARN: { text: "text-warning", bg: "bg-warning/10" },
} as const;

type VerdictType = keyof typeof VERDICT_STYLES;

// Memoized feed item for better performance with list rendering
const FeedItem = memo(function FeedItem({
  item,
  isNew,
}: {
  item: ScanVerdict;
  isNew: boolean;
}) {
  const styles = VERDICT_STYLES[item.verdict as VerdictType] || {
    text: "text-primary/60",
    bg: "bg-primary/5",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-xs transition-all",
        isNew && "animate-[fadeIn_0.3s_ease-out]",
      )}
    >
      <span className="text-primary/50 w-16 shrink-0">
        {formatTime(item.timestamp)}
      </span>
      <span className="text-primary/30">│</span>
      <span className={cn("w-14 shrink-0 font-bold", styles.text)}>
        <span className={cn("px-1.5 py-0.5 rounded", styles.bg)}>
          {item.verdict}
        </span>
      </span>
      <span className="text-primary/30">│</span>
      <span className="text-muted-foreground truncate flex-1">{item.url}</span>
    </div>
  );
});

export const LiveFeed = memo(function LiveFeed({
  maxItems = 8,
}: LiveFeedProps) {
  const [feed, setFeed] = useState<ScanVerdict[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "offline"
  >("connecting");
  const [isPaused, setIsPaused] = useState(false);
  const newestIdRef = useRef<string | null>(null);

  // Add new verdict to feed
  const addVerdict = useCallback(
    (verdict: ScanVerdict) => {
      newestIdRef.current = verdict.id;
      setFeed((prev) => [verdict, ...prev.slice(0, maxItems - 1)]);
    },
    [maxItems],
  );

  // Main SSE connection effect - only runs once on mount
  useEffect(() => {
    const eventSource = new EventSource("/api/feed");

    eventSource.onopen = () => {
      setConnectionStatus("connected");
    };

    eventSource.onmessage = (event) => {
      if (isPaused) return;
      try {
        const data = JSON.parse(event.data) as unknown;
        if (
          data &&
          typeof data === "object" &&
          "type" in data &&
          (data as { type?: string }).type === "connected"
        ) {
          return;
        }

        if (
          data &&
          typeof data === "object" &&
          typeof (data as { id?: unknown }).id === "string" &&
          typeof (data as { timestamp?: unknown }).timestamp === "string" &&
          typeof (data as { url?: unknown }).url === "string" &&
          (data as { verdict?: unknown }).verdict &&
          ["SAFE", "WARN", "DENY"].includes(
            String((data as { verdict?: unknown }).verdict),
          )
        ) {
          addVerdict(data as ScanVerdict);
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnectionStatus(
        eventSource.readyState === EventSource.CLOSED
          ? "offline"
          : "connecting",
      );
    };

    return () => {
      eventSource.close();
    };
  }, [addVerdict, isPaused]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const statusInfo = {
    connecting: { color: "bg-warning", label: "CONNECTING" },
    connected: { color: "bg-success pulse-led", label: "LIVE" },
    offline: { color: "bg-danger", label: "OFFLINE" },
    paused: { color: "bg-danger", label: "PAUSED" },
  }[isPaused ? "paused" : connectionStatus];

  return (
    <div
      className="font-mono"
      role="log"
      aria-live="polite"
      aria-atomic="false"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-primary text-sm">{`┌─ REAL-TIME SCAN LOG ─────────────────┐`}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePause}
            className="px-2 py-1 text-xs border border-border text-primary hover:bg-primary/10 transition-colors focus-ring"
            aria-label={isPaused ? "Resume feed" : "Pause feed"}
          >
            {isPaused ? "▶ RESUME" : "⏸ PAUSE"}
          </button>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", statusInfo.color)} />
            <span className="text-primary/60 text-xs">{statusInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Feed items */}
      <div className="border border-border bg-background/80 overflow-hidden max-h-96 overflow-y-auto">
        <div className="divide-y divide-border">
          {!feed.length && (
            <div className="px-4 py-8 text-center font-mono text-sm text-muted-foreground/60">
              {connectionStatus === "connected"
                ? "No scans yet"
                : "Waiting for scan events..."}
            </div>
          )}

          {feed.map((item) => (
            <FeedItem
              key={item.id}
              item={item}
              isNew={item.id === newestIdRef.current}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-primary/40 text-xs mt-1">{`└───────────────────────────────────────┘`}</div>
    </div>
  );
});
