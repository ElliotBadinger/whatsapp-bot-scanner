"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface DeployCardProps {
  name: string
  icon: React.ReactNode
  description: string
  features: string[]
  href: string
  recommended?: boolean
  onClick?: () => void
}

export function DeployCard({ name, icon, description, features, href, recommended, onClick }: DeployCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(
        "group relative block border bg-background/80 p-6 transition-all hover:bg-background focus-ring",
        recommended
          ? "border-primary shadow-[0_0_20px_var(--color-primary-glow)]"
          : "border-border hover:border-primary/60",
      )}
    >
      {/* Recommended badge */}
      {recommended && (
        <div className="absolute -top-3 left-4 bg-primary px-3 py-1 text-xs font-bold text-background">RECOMMENDED</div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-primary text-3xl">{icon}</div>
        <div>
          <h3 className="font-mono text-lg text-primary font-bold">[ {name} ]</h3>
          <p className="font-mono text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-2 mb-4">
        {features.map((feature, i) => (
          <div key={i} className="flex items-center gap-2 font-mono text-xs">
            <span className="text-primary">{`>`}</span>
            <span className="text-muted-foreground">{feature}</span>
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="font-mono text-sm text-primary group-hover:text-primary transition-colors">
        DEPLOY → <span className="opacity-0 group-hover:opacity-100 transition-opacity">▓▓▓</span>
      </div>
    </a>
  )
}
