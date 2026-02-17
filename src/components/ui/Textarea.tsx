import * as React from "react"
import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;



const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[110px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-input-text)] placeholder:text-[var(--color-input-placeholder)] transition-all duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 aria-invalid:border-[var(--color-danger)] aria-invalid:focus-visible:ring-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-55",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
