"use client"

import { QRCodeDisplay } from "./qr-code"

interface QRScannerPromptProps {
  isVisible: boolean
}

export function QRScannerPrompt({ isVisible }: QRScannerPromptProps) {
  if (!isVisible) return null

  // Mock QR value - in production this would come from the wa-client service
  const mockQRValue = `2@abc123xyz...${Date.now()}`

  return (
    <div className="border border-primary bg-background p-6 text-center">
      {/* Header */}
      <div className="mb-4">
        <div className="font-mono text-primary text-lg font-bold mb-2">SCAN TO CONNECT WHATSAPP</div>
        <div className="font-mono text-muted-foreground text-sm">Open WhatsApp → Linked Devices → Link a Device</div>
      </div>

      {/* QR Code */}
      <div className="flex justify-center py-6">
        <QRCodeDisplay value={mockQRValue} size={220} />
      </div>

      {/* Instructions */}
      <div className="space-y-2 font-mono text-xs text-left max-w-sm mx-auto">
        <div className="flex items-start gap-2">
          <span className="text-primary">1.</span>
          <span className="text-muted-foreground">Open WhatsApp on your phone</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-primary">2.</span>
          <span className="text-muted-foreground">Tap Menu or Settings → Linked Devices</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-primary">3.</span>
          <span className="text-muted-foreground">Tap "Link a Device" and scan this QR code</span>
        </div>
      </div>

      {/* Status */}
      <div className="mt-6 flex items-center justify-center gap-2 font-mono text-xs">
        <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
        <span className="text-warning">WAITING FOR SCAN...</span>
      </div>

      {/* Timer note */}
      <div className="mt-4 font-mono text-primary/40 text-xs">QR code refreshes every 60 seconds</div>
    </div>
  )
}
