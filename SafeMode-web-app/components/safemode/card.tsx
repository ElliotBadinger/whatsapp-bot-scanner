import type * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "highlighted";
}

export function SafeModeCard({
  children,
  className,
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative bg-card border p-6",
        variant === "default" && "border-border",
        variant === "highlighted" &&
          "border-primary shadow-[0_0_10px_var(--color-primary-glow)]",
        className,
      )}
      {...props}
    >
      {/* ASCII corner markers */}
      <span
        className="absolute -top-px -left-px text-primary font-mono text-xs select-none"
        aria-hidden="true"
      >
        ┌─
      </span>
      <span
        className="absolute -bottom-px -right-px text-primary font-mono text-xs select-none"
        aria-hidden="true"
      >
        ─┘
      </span>

      {children}
    </div>
  );
}

export function CardBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute -top-3 left-4 bg-background px-2 font-mono text-sm font-semibold text-primary">
      {children}
    </div>
  );
}
