'use client'

import { useState } from 'react'
import { ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react'

interface ProfileSectionProps {
  title: string
  description?: string
  /** Number of missing required fields. undefined = no badge. 0 = all complete. >0 = incomplete. */
  missingCount?: number
  defaultOpen?: boolean
  children: React.ReactNode
}

export function ProfileSection({
  title,
  description,
  missingCount,
  defaultOpen = true,
  children,
}: ProfileSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  const showBadge = typeof missingCount === 'number'
  const isComplete = showBadge && missingCount === 0
  const isIncomplete = showBadge && missingCount > 0

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-surface-subtle)] sm:px-5"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Status icon */}
          {isComplete && (
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-[var(--color-accent,#22c55e)]"
              aria-hidden="true"
            />
          )}
          {isIncomplete && (
            <AlertCircle
              className="h-4 w-4 shrink-0 text-[var(--color-warning)]"
              aria-hidden="true"
            />
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="type-subsection-title text-strong leading-tight">
                {title}
              </h2>
              {isIncomplete && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[var(--color-warning-soft,#fef3c7)] text-[var(--color-warning-strong,#92400e)]"
                  aria-label={`${missingCount} field${missingCount === 1 ? '' : 's'} missing`}
                >
                  {missingCount} missing
                </span>
              )}
            </div>
            {description && (
              <p className="type-meta mt-0.5 text-subtle">{description}</p>
            )}
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 ml-4 text-subtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] p-4 sm:p-5">
          {children}
        </div>
      )}
    </div>
  )
}
