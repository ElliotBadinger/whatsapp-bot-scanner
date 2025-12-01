"use client"

import type React from "react"

interface CRTMonitorProps {
  children?: React.ReactNode
}

export function CRTMonitor({ children }: CRTMonitorProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Monitor Casing - Beige plastic shell */}
      <div
        className="relative rounded-2xl lg:rounded-3xl p-3 lg:p-4 border-2"
        style={{
          background: "linear-gradient(135deg, #E8E6D1 0%, #D4D2BD 50%, #C4C2AD 100%)",
          borderColor: "var(--color-neutral-100)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}
      >
        {/* Screen Recess (dark shadow around screen) */}
        <div className="bg-[#1a1a1a] rounded-sm p-2">
          {/* Glass Screen */}
          <div
            className="relative bg-background overflow-hidden"
            style={{
              boxShadow: "inset 0 0 60px rgba(0, 255, 65, 0.08), inset 0 0 100px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Screen Reflection - subtle highlight */}
            <div
              className="absolute top-8 left-8 w-32 h-24 bg-white/[0.02] rounded-full blur-2xl pointer-events-none"
              aria-hidden="true"
            />

            {/* Content Area */}
            <div className="relative z-10 p-6 lg:p-12">{children}</div>

            {/* Scanline Overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `repeating-linear-gradient(
                  0deg,
                  rgba(0, 0, 0, 0.15) 0px,
                  rgba(0, 0, 0, 0.15) 1px,
                  transparent 1px,
                  transparent 2px
                )`,
              }}
              aria-hidden="true"
            />

            {/* CRT Flicker/Glow */}
            <div
              className="absolute inset-0 pointer-events-none crt-flicker"
              style={{
                background: "radial-gradient(circle, rgba(0, 255, 65, 0.08) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Monitor Bottom Panel - Brand labels and power LED */}
        <div className="mt-2 flex justify-between items-center px-4 lg:px-6 py-2">
          <span className="font-mono text-xs text-[var(--color-neutral-600)]">PORTS</span>
          <span className="font-mono text-sm lg:text-base text-[var(--color-neutral-600)]">SafeMode™</span>

          {/* Power LED */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--color-warning)] pulse-led" aria-label="Power indicator" />
            <span className="font-mono text-xs text-[var(--color-neutral-600)] hidden lg:inline">PWR</span>
          </div>
        </div>
      </div>

      {/* Monitor Stand - Neck */}
      <div className="mx-auto w-24 lg:w-32 h-4 lg:h-6 bg-gradient-to-b from-[#C4C2AD] to-[#D4D2BD]" />

      {/* Monitor Stand - Base */}
      <div
        className="mx-auto w-36 lg:w-48 h-2 lg:h-3 rounded-b-lg"
        style={{
          background: "linear-gradient(135deg, #D4D2BD 0%, #E8E6D1 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
      />

      {/* Stand Shadow */}
      <div className="mx-auto w-40 lg:w-56 h-2 rounded-full mt-1 bg-black/10 blur-sm" aria-hidden="true" />
    </div>
  )
}
