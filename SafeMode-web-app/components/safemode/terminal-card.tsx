"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface TerminalCardProps {
  title?: string
  children: React.ReactNode
  className?: string
  variant?: "default" | "glass" | "solid"
}

export function TerminalCard({ title, children, className, variant = "default" }: TerminalCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden font-mono",
        variant === "glass" && "bg-background/80 backdrop-blur-md border border-border",
        variant === "solid" && "bg-background border border-primary/40",
        variant === "default" && "bg-background/90 border border-border",
        className,
      )}
      style={{
        boxShadow: "inset 0 0 20px rgba(0, 255, 65, 0.05), 0 0 10px rgba(0, 255, 65, 0.1)",
      }}
    >
      {title && (
        <div className="border-b border-border bg-primary/5 px-4 py-2">
          <span className="text-primary text-sm">{`┌─ ${title} ─`}</span>
        </div>
      )}
      <div className="p-4">{children}</div>
      {title && (
        <div className="border-t border-border bg-primary/5 px-4 py-1">
          <span className="text-primary/50 text-xs">└───────────────────────────────────────┘</span>
        </div>
      )}
    </div>
  )
}
