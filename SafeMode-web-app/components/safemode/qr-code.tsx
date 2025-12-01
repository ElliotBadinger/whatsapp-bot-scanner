"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export function QRCodeDisplay({ value, size = 200 }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: "#00FF41", // Terminal green
          light: "#0D1117", // Void black
        },
        errorCorrectionLevel: "M",
      });
    }
  }, [value, size]);

  return (
    <div className="relative inline-block">
      {/* QR code glow effect */}
      <div
        className="absolute inset-0 blur-xl opacity-30 bg-primary"
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="relative border-2 border-primary/40"
        style={{
          boxShadow:
            "0 0 20px var(--color-primary-glow), inset 0 0 10px rgba(0, 255, 65, 0.1)",
        }}
        aria-label="QR Code"
      />
    </div>
  );
}
