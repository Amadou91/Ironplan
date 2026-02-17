import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary:
        "bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-strong)] active:translate-y-px",
      secondary:
        "bg-[var(--color-surface-muted)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] active:translate-y-px",
      outline:
        "border border-[var(--color-border-strong)] text-[var(--color-text)] bg-transparent hover:bg-[var(--color-surface-subtle)] active:translate-y-px",
      ghost:
        "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]",
      danger:
        "bg-[var(--color-danger)] text-[var(--color-text-inverse)] shadow-[var(--shadow-sm)] hover:bg-[color-mix(in_oklch,var(--color-danger),black_16%)] active:translate-y-px",
      link:
        "rounded-none px-0 text-[var(--color-primary-strong)] underline-offset-4 hover:underline"
    }

    const sizes = {
      sm: "h-9 px-3.5 text-sm",
      md: "h-11 px-5 text-sm",
      lg: "h-12 px-6 text-base",
      icon: "h-10 w-10 p-0"
    }

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold whitespace-nowrap transition-all duration-[var(--motion-fast)] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
