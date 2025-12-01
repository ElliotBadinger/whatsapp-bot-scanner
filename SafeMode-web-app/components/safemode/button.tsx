import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  asChild?: boolean;
}

export const SafeModeButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "px-6 py-3 min-w-40 min-h-12",
          "font-mono text-sm font-semibold tracking-wide uppercase",
          "bg-transparent border-2 transition-all duration-150",
          "focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:outline-none",
          variant === "primary" && [
            "border-primary text-primary",
            "shadow-[0_0_10px_var(--color-primary-glow)]",
            "hover:bg-primary hover:text-background",
            "hover:shadow-[0_0_20px_var(--color-primary-glow)]",
            "hover:-translate-y-0.5",
            "active:translate-y-0 active:shadow-[0_0_5px_var(--color-primary-glow)]",
          ],
          variant === "secondary" && [
            "border-border text-muted-foreground",
            "hover:border-primary hover:text-primary",
          ],
          className,
        )}
        {...props}
      >
        <span className="flex items-center justify-center gap-2">
          <span>[</span>
          {children}
          <span>→]</span>
        </span>
      </button>
    );
  },
);
SafeModeButton.displayName = "SafeModeButton";
