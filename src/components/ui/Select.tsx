import * as React from "react"
import { cn } from "@/lib/utils"

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;



const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 py-2 text-sm font-medium text-[var(--color-input-text)] transition-all duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 aria-invalid:border-[var(--color-danger)] aria-invalid:focus:ring-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-55",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Select }
