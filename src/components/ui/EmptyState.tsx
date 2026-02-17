import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('surface-card-muted rounded-[var(--radius-lg)] border-dashed p-8 text-center', className)}>
      {icon ? <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface)] text-subtle">{icon}</div> : null}
      <h2 className="font-display text-xl font-semibold text-strong">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-lg text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}
