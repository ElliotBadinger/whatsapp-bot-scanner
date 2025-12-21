"use client";

import { useEffect, useRef, useState, memo } from "react";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

// Lazy load QRCode library only when component is rendered
const QRCodeDisplay = memo(function QRCodeDisplay({
  value,
  size = 200,
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Dynamic import to reduce initial bundle size
    import("qrcode").then((QRCode) => {
      if (isMounted && canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, value, {
          width: size,
          margin: 2,
          color: {
            dark: "#00FF41", // Terminal green
            light: "#0D1117", // Void black
          },
          errorCorrectionLevel: "M",
        }).then(() => {
          if (isMounted) setIsLoaded(true);
        });
      }
    });

    return () => {
      isMounted = false;
    };
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
        width={size}
        height={size}
        style={{
          boxShadow:
            "0 0 20px var(--color-primary-glow), inset 0 0 10px rgba(0, 255, 65, 0.1)",
          opacity: isLoaded ? 1 : 0.5,
          transition: "opacity 0.3s ease-in-out",
        }}
        aria-label="QR Code"
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-primary/60 text-xs font-mono">Loading...</span>
        </div>
      )}
    </div>
  );
});

export { QRCodeDisplay };
