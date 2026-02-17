'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

type TabsProps = {
  tabs: Array<{ id: string; label: string }>
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function Tabs({ tabs, value, onValueChange, className }: TabsProps) {
  const groupId = useId()

  return (
    <div className={cn('inline-flex rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1', className)} role="tablist" aria-label="Sections">
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            id={`${groupId}-${tab.id}`}
            role="tab"
            aria-selected={selected}
            aria-controls={`${groupId}-${tab.id}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(tab.id)}
            className={cn(
              'rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
              selected ? 'bg-[var(--color-surface)] text-strong shadow-[var(--shadow-sm)]' : 'text-muted hover:text-strong'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
