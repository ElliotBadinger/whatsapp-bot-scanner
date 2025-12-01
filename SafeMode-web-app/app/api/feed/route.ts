import type { ScanVerdict } from "@/lib/api"

// Mock data for SSE stream
const mockUrls = [
  { url: "github.com/vercel/next.js", verdict: "SAFE" as const },
  { url: "bit.ly/3xYz123", verdict: "SCAN" as const },
  { url: "phishing-site.xyz/login", verdict: "DENY" as const },
  { url: "docs.google.com/d/abc", verdict: "SAFE" as const },
  { url: "suspicious-link.ru/click", verdict: "WARN" as const },
  { url: "linkedin.com/post/456", verdict: "SAFE" as const },
  { url: "malware-host.net/payload", verdict: "DENY" as const },
  { url: "youtube.com/watch?v=xyz", verdict: "SAFE" as const },
]

function generateMockVerdict(): ScanVerdict {
  const mock = mockUrls[Math.floor(Math.random() * mockUrls.length)]
  return {
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    url: mock.url,
    verdict: mock.verdict,
  }
}

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`))

      // Send mock verdicts periodically
      const interval = setInterval(
        () => {
          const verdict = generateMockVerdict()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(verdict)}\n\n`))
        },
        4000 + Math.random() * 3000,
      )

      // Clean up on close
      const cleanup = () => {
        clearInterval(interval)
        controller.close()
      }

      // Keep connection alive with pings
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          cleanup()
        }
      }, 30000)

      // Auto-close after 5 minutes to prevent memory leaks
      setTimeout(() => {
        clearInterval(pingInterval)
        cleanup()
      }, 300000)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
