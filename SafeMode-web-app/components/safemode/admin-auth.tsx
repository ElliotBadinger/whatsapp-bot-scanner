"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavBar } from "./nav-bar";
import { TerminalCard } from "./terminal-card";
import { ApiError, loginAdmin } from "@/lib/api";
import { ensureCsrfToken } from "@/lib/csrf-client";

interface AdminAuthProps {
  onAuthenticated: () => void;
}

export function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    ensureCsrfToken().catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await loginAdmin(token);
      onAuthenticated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("ACCESS_DENIED: Invalid token");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("ACCESS_DENIED: CSRF validation failed");
      } else {
        setError("AUTH_FAILED: Unable to authenticate");
      }
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
