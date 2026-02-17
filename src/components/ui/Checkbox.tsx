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
    const checkedState = checked === 'indeterminate' ? 'indeterminate' : checked ? 'checked' : 'unchecked'

    return (
      <label className={cn(
        "group flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-transparent p-2.5 transition-colors hover:bg-[var(--color-surface-subtle)] cursor-pointer",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}>
        <input
          type="checkbox"
          className="peer sr-only"
          ref={ref}
          checked={checked === true}
          disabled={disabled}
          aria-checked={checked === 'indeterminate' ? 'mixed' : checked === true}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <div
          className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-inverse)] transition-all duration-[var(--motion-fast)] ease-[var(--ease-standard)] group-hover:border-[var(--color-primary-border)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-bg)] data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)] data-[state=indeterminate]:border-[var(--color-primary)] data-[state=indeterminate]:bg-[var(--color-primary)]"
          data-state={checkedState}
        >
          {checked === true && (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          )}
          {checked === 'indeterminate' && (
            <Minus className="h-3.5 w-3.5" strokeWidth={3} />
          )}
        </div>
        {label && (
          <span className="text-sm font-medium text-[var(--color-text)] select-none leading-tight">
            {label}
          </span>
        )}
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
