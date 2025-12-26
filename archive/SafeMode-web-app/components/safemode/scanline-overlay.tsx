"use client";

export function ScanlineOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Scanline effect */}
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          )`,
        }}
      />
      {/* Moving scanline */}
      <div
        className="absolute left-0 right-0 h-[200px] animate-[scanline_8s_linear_infinite]"
        style={{
          background: `linear-gradient(
            to bottom,
            transparent 0%,
            rgba(0, 255, 65, 0.03) 50%,
            transparent 100%
          )`,
        }}
      />
      {/* CRT vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 60%,
            rgba(0, 0, 0, 0.4) 100%
          )`,
        }}
      />
    </div>
  );
}
