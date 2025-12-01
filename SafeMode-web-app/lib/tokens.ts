// SafeMode Design System Tokens
export const colors = {
  // Semantic Tokens
  primary: "var(--color-primary)",
  "primary-dim": "var(--color-primary-dim)",
  "primary-glow": "var(--color-primary-glow)",

  background: "var(--color-background)",
  surface: "var(--color-surface)",
  "surface-elevated": "var(--color-surface-elevated)",

  foreground: "var(--color-foreground)",
  "foreground-muted": "var(--color-foreground-muted)",
  "foreground-dim": "var(--color-foreground-dim)",

  border: "var(--color-border)",
  "border-muted": "var(--color-border-muted)",

  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",

  "neutral-50": "var(--color-neutral-50)",
  "neutral-100": "var(--color-neutral-100)",
  "neutral-600": "var(--color-neutral-600)",
  "neutral-900": "var(--color-neutral-900)",
} as const;

export const spacing = {
  1: "var(--space-1)",
  2: "var(--space-2)",
  3: "var(--space-3)",
  4: "var(--space-4)",
  5: "var(--space-5)",
  6: "var(--space-6)",
  8: "var(--space-8)",
  10: "var(--space-10)",
  12: "var(--space-12)",
  16: "var(--space-16)",
  20: "var(--space-20)",
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
