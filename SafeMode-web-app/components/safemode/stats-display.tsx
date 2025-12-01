"use client"

import useSWR from "swr"
import { getStatus, type SystemStatus } from "@/lib/api"
import { StatsCard } from "./stats-card"

export function StatsDisplay() {
  const { data: status } = useSWR<SystemStatus>("status", getStatus, {
    refreshInterval: 10000,
    fallbackData: {
      scansToday: 1247,
      threatsBlocked: 23,
      cacheHitRate: 87,
      groupsProtected: 342,
      uptime: "99.97%",
      version: "1.0.0",
    },
  })

  const threatPercent = status?.scansToday ? ((status.threatsBlocked / status.scansToday) * 100).toFixed(1) : "0"

  return (
    <section className="py-8 lg:py-12" aria-labelledby="stats-heading">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 bg-primary rounded-full pulse-led" aria-hidden="true" />
        <h2 id="stats-heading" className="font-mono text-sm font-semibold text-primary tracking-wide">
          {`> LIVE STATUS`}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8">
        <StatsCard value={status?.scansToday?.toLocaleString() ?? "---"} label="SCANS (24H)" variant="neutral" />
        <StatsCard value={status?.threatsBlocked ?? "---"} label={`BLOCKED (${threatPercent}%)`} variant="danger" />
        <StatsCard value={status?.groupsProtected ?? "---"} label="GROUPS PROTECTED" variant="success" />
      </div>
    </section>
  )
}
