"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface DeployProgressProps {
  isDeploying: boolean
  onComplete?: () => void
}

const deploySteps = [
  { message: "Initializing deployment...", duration: 1500 },
  { message: "Creating Redis instance...", duration: 2000 },
  { message: "Setting up PostgreSQL...", duration: 2500 },
  { message: "Building wa-client service...", duration: 3000 },
  { message: "Configuring control-plane...", duration: 2000 },
  { message: "Starting verdict-engine...", duration: 2500 },
  { message: "Running health checks...", duration: 1500 },
  { message: "Generating QR code...", duration: 1000 },
  { message: "DEPLOYMENT COMPLETE", duration: 0 },
]

export function DeployProgress({ isDeploying, onComplete }: DeployProgressProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isDeploying) {
      setCurrentStep(0)
      setLogs([])
      setProgress(0)
      return
    }

    let stepIndex = 0
    let totalTime = 0
    const totalDuration = deploySteps.reduce((acc, step) => acc + step.duration, 0)

    const runStep = () => {
      if (stepIndex >= deploySteps.length) {
        onComplete?.()
        return
      }

      const step = deploySteps[stepIndex]
      const timestamp = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })

      setCurrentStep(stepIndex)
      setLogs((prev) => [...prev, `[${timestamp}] ${step.message}`])

      totalTime += step.duration
      setProgress(Math.min(100, Math.floor((totalTime / totalDuration) * 100)))

      if (step.duration > 0) {
        setTimeout(() => {
          stepIndex++
          runStep()
        }, step.duration)
      }
    }

    runStep()
  }, [isDeploying, onComplete])

  if (!isDeploying && logs.length === 0) return null

  return (
    <div className="border border-primary/40 bg-background">
      {/* Header */}
      <div className="border-b border-border bg-primary/5 px-4 py-2 flex items-center justify-between">
        <span className="font-mono text-primary text-sm">┌─ DEPLOYMENT LOG ─┐</span>
        <span className="font-mono text-primary/60 text-xs">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-background">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Logs */}
      <div className="p-4 max-h-64 overflow-y-auto font-mono text-xs">
        {logs.map((log, i) => (
          <div
            key={i}
            className={cn(
              "py-1",
              i === logs.length - 1 && isDeploying && "text-primary",
              log.includes("COMPLETE") && "text-primary font-bold",
              !log.includes("COMPLETE") && !(i === logs.length - 1 && isDeploying) && "text-muted-foreground",
            )}
          >
            {log}
            {i === logs.length - 1 && isDeploying && <span className="cursor-blink ml-1">▊</span>}
          </div>
        ))}
      </div>

      {/* ASCII progress bar */}
      <div className="border-t border-border px-4 py-2">
        <div className="font-mono text-xs text-primary">
          [<span className="text-primary">{"▓".repeat(Math.floor(progress / 5))}</span>
          <span className="text-primary/20">{"░".repeat(20 - Math.floor(progress / 5))}</span>]
        </div>
      </div>
    </div>
  )
}
