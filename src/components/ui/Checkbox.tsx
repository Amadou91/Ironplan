import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked'> {
  checked?: boolean | 'indeterminate'
  onCheckedChange?: (checked: boolean) => void
  label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, label, ...props }, ref) => {
    return (
      <label className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:bg-[var(--color-surface-subtle)] cursor-pointer",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}>
        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] transition-all data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)] data-[state=indeterminate]:border-[var(--color-primary)] data-[state=indeterminate]:bg-[var(--color-primary)] text-white"
          data-state={checked === 'indeterminate' ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
        >
          <input
            type="checkbox"
            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            ref={ref}
            checked={checked === true}
            disabled={disabled}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            {...props}
          />
          {checked === true && (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          )}
          {checked === 'indeterminate' && (
            <Minus className="h-3.5 w-3.5" strokeWidth={3} />
          )}
        </div>
        {label && (
          <span className="text-sm font-medium text-[var(--color-text)] select-none">
            {label}
          </span>
        )}
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
