import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;



const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 py-2 text-[15px] font-medium text-[var(--color-input-text)] ring-offset-[var(--color-bg)] transition-all duration-[var(--motion-fast)] ease-[var(--ease-standard)] file:border-0 file:bg-transparent file:text-[15px] file:font-medium placeholder:text-[var(--color-input-placeholder)] hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 aria-invalid:border-[var(--color-danger)] aria-invalid:focus-visible:ring-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-55",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
