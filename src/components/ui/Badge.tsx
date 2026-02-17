import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]",
    secondary: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
    destructive: "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    outline: "border-[var(--color-border)] bg-transparent text-[var(--color-text)]",
    success: "border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success-strong)]",
    warning: "border-[color-mix(in_oklch,var(--color-warning),white_70%)] bg-[color-mix(in_oklch,var(--color-warning),white_86%)] text-[color-mix(in_oklch,var(--color-warning),black_35%)]",
    info: "border-[color-mix(in_oklch,var(--color-info),white_70%)] bg-[color-mix(in_oklch,var(--color-info),white_86%)] text-[color-mix(in_oklch,var(--color-info),black_30%)]",
  }
  
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2", variants[variant], className)} {...props} />
  )
}

export { Badge }
