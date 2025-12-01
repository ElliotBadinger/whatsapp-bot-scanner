"use client"

import { useEffect, useState } from "react"
import type { ScanVerdict } from "@/lib/api"
import { cn } from "@/lib/utils"

interface LiveFeedProps {
  maxItems?: number
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function getVerdictColor(verdict: ScanVerdict["verdict"]): string {
  switch (verdict) {
    case "SAFE":
      return "text-success"
    case "DENY":
      return "text-danger"
    case "WARN":
      return "text-warning"
    case "SCAN":
      return "text-muted-foreground"
    default:
      return "text-primary/60"
  }
}

function getVerdictBg(verdict: ScanVerdict["verdict"]): string {
  switch (verdict) {
    case "SAFE":
      return "bg-success/10"
    case "DENY":
      return "bg-danger/10"
    case "WARN":
      return "bg-warning/10"
    case "SCAN":
      return "bg-muted/30"
    default:
      return "bg-primary/5"
  }
}

// Mock data generator
const mockUrls = [
  { url: "github.com/vercel/next.js", verdict: "SAFE" as const },
  { url: "bit.ly/3xYz123", verdict: "SCAN" as const },
  { url: "phishing-site.xyz/login", verdict: "DENY" as const },
  { url: "docs.google.com/d/abc", verdict: "SAFE" as const },
  { url: "suspicious-link.ru/click", verdict: "WARN" as const },
  { url: "linkedin.com/post/456", verdict: "SAFE" as const },
  { url: "malware-host.net/payload", verdict: "DENY" as const },
  { url: "youtube.com/watch?v=xyz", verdict: "SAFE" as const },
  { url: "dropbox.com/s/abc123", verdict: "SAFE" as const },
  { url: "free-prize.win/claim", verdict: "DENY" as const },
]

export function LiveFeed({ maxItems = 8 }: LiveFeedProps) {
  const [feed, setFeed] = useState<ScanVerdict[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    // Initialize with some mock data
    const initialFeed: ScanVerdict[] = Array.from({ length: 5 }, () => {
      const mock = mockUrls[Math.floor(Math.random() * mockUrls.length)]
      return {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(Date.now() - Math.random() * 60000).toISOString(),
        url: mock.url,
        verdict: mock.verdict,
      }
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    setFeed(initialFeed)
    setIsConnected(true)

    // Simulate SSE with random events
    const interval = setInterval(
      () => {
        if (isPaused) return
        const mock = mockUrls[Math.floor(Math.random() * mockUrls.length)]
        const newVerdict: ScanVerdict = {
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          url: mock.url,
          verdict: mock.verdict,
        }

        setFeed((prev) => [newVerdict, ...prev.slice(0, maxItems - 1)])
      },
      3000 + Math.random() * 2000,
    )

    // Try to connect to real SSE endpoint
    const eventSource = new EventSource("/api/feed")

    eventSource.onmessage = (event) => {
      if (isPaused) return
      try {
        const verdict: ScanVerdict = JSON.parse(event.data)
        setFeed((prev) => [verdict, ...prev.slice(0, maxItems - 1)])
      } catch {
        // Ignore parse errors, mock data will continue
      }
    }

    eventSource.onerror = () => {
      // SSE not available, mock data continues
    }

    return () => {
      clearInterval(interval)
      eventSource.close()
    }
  }, [maxItems, isPaused])

  return (
    <div className="font-mono" role="log" aria-live="polite" aria-atomic="false">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-primary text-sm">{`┌─ REAL-TIME SCAN LOG ─────────────────┐`}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="px-2 py-1 text-xs border border-border text-primary hover:bg-primary/10 transition-colors focus-ring"
            aria-label={isPaused ? "Resume feed" : "Pause feed"}
          >
            {isPaused ? "▶ RESUME" : "⏸ PAUSE"}
          </button>
          <div className="flex items-center gap-2">
            <span
              className={cn("h-2 w-2 rounded-full", isConnected && !isPaused ? "bg-success pulse-led" : "bg-danger")}
            />
            <span className="text-primary/60 text-xs">{isPaused ? "PAUSED" : isConnected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>
      </div>

      {/* Feed items */}
      <div className="border border-border bg-background/80 overflow-hidden max-h-96 overflow-y-auto">
        <div className="divide-y divide-border">
          {feed.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs transition-all",
                index === 0 && "animate-[fadeIn_0.3s_ease-out]",
              )}
            >
              <span className="text-primary/50 w-16 shrink-0">{formatTime(item.timestamp)}</span>
              <span className="text-primary/30">│</span>
              <span className={cn("w-14 shrink-0 font-bold", getVerdictColor(item.verdict))}>
                <span className={cn("px-1.5 py-0.5 rounded", getVerdictBg(item.verdict))}>{item.verdict}</span>
              </span>
              <span className="text-primary/30">│</span>
              <span className="text-muted-foreground truncate flex-1">{item.url}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-primary/40 text-xs mt-1">{`└───────────────────────────────────────┘`}</div>
    </div>
  )
}
