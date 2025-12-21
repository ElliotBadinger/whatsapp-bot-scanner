"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NavBar } from "./nav-bar"
import { TerminalCard } from "./terminal-card"

interface AdminAuthProps {
  onAuthenticated: () => void
}

export function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const [token, setToken] = useState("")
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadCsrf = async () => {
      try {
        const resp = await fetch("/api/auth/csrf", { cache: "no-store" })
        if (!resp.ok) {
          throw new Error("csrf_failed")
        }
        const body = (await resp.json().catch(() => null)) as
          | { csrfToken?: unknown }
          | null
        const raw = body && typeof body.csrfToken === "string" ? body.csrfToken : null
        if (!raw) {
          throw new Error("csrf_failed")
        }
        if (!cancelled) {
          setCsrfToken(raw)
        }
      } catch {
        if (!cancelled) {
          setError("AUTH_INIT_FAILED: Unable to initialize session")
        }
      }
    }

    loadCsrf()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!csrfToken) {
        throw new Error("csrf_missing")
      }

      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, csrfToken }),
      })

      if (resp.ok) {
        onAuthenticated()
        return
      }

      const body = (await resp.json().catch(() => null)) as
        | { error?: unknown }
        | null
      const code = body && typeof body.error === "string" ? body.error : null

      if (resp.status === 401) {
        setError("ACCESS_DENIED: Invalid token")
      } else if (resp.status === 403) {
        setError("ACCESS_DENIED: CSRF check failed")
      } else if (resp.status === 429) {
        setError("RATE_LIMITED: Try again later")
      } else if (code) {
        setError(`AUTH_FAILED: ${code.toUpperCase()}`)
      } else {
        setError("AUTH_FAILED: Unexpected error")
      }
    } catch {
      setError("AUTH_FAILED: Unexpected error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="flex items-center justify-center p-4 py-20">
        <div className="w-full max-w-md">
          <TerminalCard title="ADMIN AUTHENTICATION" variant="solid">
            <div className="space-y-6">
              {/* ASCII art lock */}
              <pre className="font-mono text-primary/60 text-xs text-center">
                {`    ██████
   ██    ██
   ██    ██
 ████████████
 ██        ██
 ██  ████  ██
 ██  ████  ██
 ██        ██
 ████████████`}
              </pre>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-primary/60 mb-2">{`> ENTER API TOKEN`}</label>
                  <Input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="bg-background border-border text-secondary placeholder:text-muted-foreground/40 font-mono focus-ring"
                  />
                </div>

                {error && (
                  <div className="font-mono text-xs text-danger bg-danger/10 border border-danger/30 p-3">{error}</div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || !token.trim() || !csrfToken}
                  className="w-full bg-primary text-background hover:bg-primary/80 font-mono font-bold"
                >
                  {isLoading ? "AUTHENTICATING..." : "[ AUTHENTICATE ]"}
                </Button>
              </form>
            </div>
          </TerminalCard>
        </div>
      </div>
    </div>
  )
}
