'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type TooltipProps = {
  content: string
  children: ReactNode
  className?: string
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute -top-2 left-1/2 z-[var(--z-tooltip)] w-max max-w-xs -translate-x-1/2 -translate-y-full rounded-md bg-[var(--color-text)] px-2 py-1 text-xs text-[var(--color-text-inverse)] shadow-[var(--shadow-md)] transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
      >
        {content}
      </span>
    </span>
  )
}
