"use client"

import { useEffect, useState, useCallback, memo, useRef } from "react"
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

const VERDICT_STYLES = {
  SAFE: { text: "text-success", bg: "bg-success/10" },
  DENY: { text: "text-danger", bg: "bg-danger/10" },
  WARN: { text: "text-warning", bg: "bg-warning/10" },
  SCAN: { text: "text-muted-foreground", bg: "bg-muted/30" },
} as const

type VerdictType = keyof typeof VERDICT_STYLES

// Memoized feed item for better performance with list rendering
const FeedItem = memo(function FeedItem({ 
  item, 
  isNew 
}: { 
  item: ScanVerdict
  isNew: boolean 
}) {
  const styles = VERDICT_STYLES[item.verdict as VerdictType] || { text: "text-primary/60", bg: "bg-primary/5" }
  
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-xs transition-all",
        isNew && "animate-[fadeIn_0.3s_ease-out]",
      )}
    >
      <span className="text-primary/50 w-16 shrink-0">{formatTime(item.timestamp)}</span>
      <span className="text-primary/30">│</span>
      <span className={cn("w-14 shrink-0 font-bold", styles.text)}>
        <span className={cn("px-1.5 py-0.5 rounded", styles.bg)}>{item.verdict}</span>
      </span>
      <span className="text-primary/30">│</span>
      <span className="text-muted-foreground truncate flex-1">{item.url}</span>
    </div>
  )
})

// Mock data for demonstration
const MOCK_URLS = [
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
] as const

function generateMockVerdict(): ScanVerdict {
  const mock = MOCK_URLS[Math.floor(Math.random() * MOCK_URLS.length)]
  return {
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    url: mock.url,
    verdict: mock.verdict,
  }
}

export const LiveFeed = memo(function LiveFeed({ maxItems = 8 }: LiveFeedProps) {
  const [feed, setFeed] = useState<ScanVerdict[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "fallback" | "paused">("connecting")
  const [isPaused, setIsPaused] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const newestIdRef = useRef<string | null>(null)

  // Initialize with mock data
  useEffect(() => {
    const initialFeed: ScanVerdict[] = Array.from({ length: 5 }, () => {
      const mock = MOCK_URLS[Math.floor(Math.random() * MOCK_URLS.length)]
      return {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(Date.now() - Math.random() * 60000).toISOString(),
        url: mock.url,
        verdict: mock.verdict,
      }
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    setFeed(initialFeed)
    if (initialFeed[0]) newestIdRef.current = initialFeed[0].id
  }, [])

  // Add new verdict to feed
  const addVerdict = useCallback((verdict: ScanVerdict) => {
    newestIdRef.current = verdict.id
    setFeed((prev) => [verdict, ...prev.slice(0, maxItems - 1)])
  }, [maxItems])

  // Start fallback mock data generator
  const startFallback = useCallback(() => {
    if (fallbackIntervalRef.current) return
    
    setConnectionStatus("fallback")
    fallbackIntervalRef.current = setInterval(() => {
      if (!isPaused) {
        addVerdict(generateMockVerdict())
      }
    }, 3000 + Math.random() * 2000)
  }, [addVerdict, isPaused])

  // Stop fallback
  const stopFallback = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current)
      fallbackIntervalRef.current = null
    }
  }, [])

  // Main SSE connection effect - only runs once on mount
  useEffect(() => {
    // Try to connect to real SSE endpoint
    const eventSource = new EventSource("/api/feed")
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnectionStatus("connected")
      stopFallback() // Stop fallback if SSE connects successfully
    }

    eventSource.onmessage = (event) => {
      if (isPaused) return
      try {
        const verdict: ScanVerdict = JSON.parse(event.data)
        addVerdict(verdict)
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      // SSE not available, use fallback mock data
      eventSource.close()
      startFallback()
    }

    // Auto-start fallback after 2 second timeout if no connection
    const timeoutId = setTimeout(() => {
      if (eventSource.readyState !== EventSource.OPEN) {
        startFallback()
      }
    }, 2000)

    return () => {
      clearTimeout(timeoutId)
      eventSource.close()
      stopFallback()
    }
  }, [addVerdict, startFallback, stopFallback, isPaused])

  // Handle pause state changes for fallback interval
  useEffect(() => {
    if (isPaused) {
      setConnectionStatus("paused")
      stopFallback()
    } else if (connectionStatus === "paused" || fallbackIntervalRef.current === null) {
      // Resume fallback if we were using it
      if (eventSourceRef.current?.readyState !== EventSource.OPEN) {
        startFallback()
      } else {
        setConnectionStatus("connected")
      }
    }
  }, [isPaused, connectionStatus, startFallback, stopFallback])

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev)
  }, [])

  const statusInfo = {
    connecting: { color: "bg-warning", label: "CONNECTING" },
    connected: { color: "bg-success pulse-led", label: "LIVE" },
    fallback: { color: "bg-success pulse-led", label: "LIVE" },
    paused: { color: "bg-danger", label: "PAUSED" },
  }[connectionStatus]

  return (
    <div className="font-mono" role="log" aria-live="polite" aria-atomic="false">
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
  )
})
