import { memo } from "react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  value: string | number
  label: string
  variant?: "success" | "danger" | "neutral"
}

const VARIANT_STYLES = {
  success: "from-success/5 to-success/[0.01] border-success/30 text-success",
  danger: "from-danger/5 to-danger/[0.01] border-danger/30 text-danger",
  neutral: "from-primary/5 to-primary/[0.01] border-border text-primary",
} as const

export const StatsCard = memo(function StatsCard({ 
  value, 
  label, 
  variant = "success" 
}: StatsCardProps) {
  return (
    <div className={cn("bg-gradient-to-br border p-6 lg:p-10 text-center", VARIANT_STYLES[variant])}>
      <div className="font-mono text-3xl lg:text-5xl drop-shadow-[0_0_20px_currentColor] mb-2">
        {value}
      </div>
      <div className="font-mono text-xs lg:text-sm text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
    </div>
  )
})
