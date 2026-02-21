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
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <p className="type-overline text-subtle">{eyebrow}</p>}
        <h1 className="type-page-title text-strong">{title}</h1>
        {description && <p className="type-body max-w-3xl text-muted">{description}</p>}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
    </header>
  )
}
