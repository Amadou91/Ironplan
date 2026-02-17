import type { HTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'success' | 'warning' | 'error' | 'info'

const iconByVariant: Record<AlertVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
  error: <XCircle className="h-4 w-4" aria-hidden="true" />,
  info: <Info className="h-4 w-4" aria-hidden="true" />
}

const classByVariant: Record<AlertVariant, string> = {
  success: 'border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success-strong)]',
  warning: 'border-[color-mix(in_oklch,var(--color-warning),white_70%)] bg-[color-mix(in_oklch,var(--color-warning),white_88%)] text-[color-mix(in_oklch,var(--color-warning),black_45%)]',
  error: 'border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  info: 'border-[color-mix(in_oklch,var(--color-info),white_70%)] bg-[color-mix(in_oklch,var(--color-info),white_88%)] text-[var(--color-info)]'
}

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant
  title?: string
}

export function Alert({ className, variant = 'info', title, children, ...props }: AlertProps) {
  return (
    <div
      className={cn('rounded-[var(--radius-lg)] border px-4 py-3', classByVariant[variant], className)}
      role={variant === 'error' ? 'alert' : 'status'}
      {...props}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">{iconByVariant[variant]}</span>
        <div className="space-y-0.5">
          {title ? <p className="text-sm font-semibold leading-5">{title}</p> : null}
          {children ? <div className="text-sm leading-5">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}
