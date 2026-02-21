import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AppStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function AppState({ icon, title, description, actions, className }: AppStateProps) {
  return (
    <section
      className={cn(
        'surface-card-muted mx-auto flex w-full max-w-xl flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed px-6 py-8 text-center sm:px-8 sm:py-10',
        className
      )}
      aria-live="polite"
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface)] text-subtle shadow-[var(--shadow-sm)]">
          {icon}
        </div>
      ) : null}
      <h1 className="font-display text-2xl font-semibold text-strong">{title}</h1>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </section>
  )
}
