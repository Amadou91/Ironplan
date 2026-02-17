import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { className, pressed, onPressedChange, ...props },
  ref
) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      className={cn(
        'inline-flex h-8 w-14 items-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
        pressed && 'bg-[var(--color-primary-soft)] border-[var(--color-primary-border)]',
        className
      )}
      onClick={() => onPressedChange(!pressed)}
      ref={ref}
      {...props}
    >
      <span
        className={cn(
          'h-6 w-6 rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-sm)] transition-transform',
          pressed && 'translate-x-6 bg-[var(--color-primary)]'
        )}
      />
    </button>
  )
})
