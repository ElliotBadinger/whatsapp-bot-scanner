"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavBar } from "./nav-bar";
import { TerminalCard } from "./terminal-card";

interface AdminAuthProps {
  onAuthenticated: () => void;
}

export function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    setIsLoading(true);
    fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((resp) => {
        if (resp.ok) {
          onAuthenticated();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (resp.ok) {
        onAuthenticated();
        return;
      }

      const payload = (await resp.json().catch(() => null)) as {
        error?: string;
      } | null;
      const code = payload?.error;
      if (resp.status === 401) {
        setError("ACCESS_DENIED: Invalid token");
      } else if (resp.status === 500 && code === "server_not_configured") {
        setError("SERVER_ERROR: SAFEMODE_ADMIN_TOKEN is not configured");
      } else {
        setError("REQUEST_FAILED: Unable to authenticate");
      }
    } catch {
      setError("REQUEST_FAILED: Unable to authenticate");
    } finally {
      setIsLoading(false);
    }
  };

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
                  <div className="font-mono text-xs text-danger bg-danger/10 border border-danger/30 p-3">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || !token.trim()}
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
  );
}
