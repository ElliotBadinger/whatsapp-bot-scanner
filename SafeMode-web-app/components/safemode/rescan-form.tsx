"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { rescanUrl, type ScanVerdict } from "@/lib/api"
import { cn } from "@/lib/utils"

export function RescanForm() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ScanVerdict | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const verdict = await rescanUrl(url)
      setResult(verdict)
    } catch {
      setError("SCAN_FAILED: Unable to process URL")
    } finally {
      setIsLoading(false)
    }
  }

  const getVerdictStyle = (verdict: ScanVerdict["verdict"]) => {
    switch (verdict) {
      case "SAFE":
        return "text-success bg-success/10 border-success/40"
      case "DENY":
        return "text-danger bg-danger/10 border-danger/40"
      case "WARN":
        return "text-warning bg-warning/10 border-warning/40"
      default:
        return "text-muted-foreground bg-muted/10 border-border"
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="url"
          placeholder="https://example.com/suspicious-link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-background border-border text-secondary placeholder:text-muted-foreground/30 font-mono text-sm focus:border-primary focus:ring-primary/20 focus-ring"
        />
        <Button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="bg-primary text-background hover:bg-primary/80 font-mono font-bold disabled:opacity-50"
        >
          {isLoading ? "SCANNING..." : "[ RESCAN ]"}
        </Button>
      </form>

      {/* Result */}
      {result && (
        <div className={cn("border p-4 font-mono text-sm", getVerdictStyle(result.verdict))}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">VERDICT: {result.verdict}</span>
            <span className="text-xs opacity-60">{new Date(result.timestamp).toLocaleString()}</span>
          </div>
          <div className="text-xs opacity-70 break-all">URL: {result.url}</div>
          {result.category && <div className="text-xs opacity-70 mt-1">CATEGORY: {result.category}</div>}
        </div>
      )}

      {/* Error */}
      {error && <div className="border border-danger/40 bg-danger/10 p-4 font-mono text-sm text-danger">{error}</div>}
    </div>
  )
}
