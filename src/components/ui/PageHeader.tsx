'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('page-header', className)}>
      <div className="space-y-2">
        {eyebrow && <p className="text-[11px] uppercase tracking-[0.24em] text-subtle font-semibold">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-strong sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
