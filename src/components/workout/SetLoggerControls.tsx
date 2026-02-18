'use client'

import React from 'react'
import type { WorkoutSet } from '@/types/domain'
import { Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetLoggerHeaderProps {
  setNumber: number
  onDelete: () => void
}

export function SetLoggerHeader({ setNumber, onDelete }: SetLoggerHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-sm font-bold text-[var(--color-text)] border border-[var(--color-border)]">
          {setNumber}
        </div>
        <span className="text-sm font-semibold text-muted">Set {setNumber}</span>
      </div>
      <button
        onClick={onDelete}
        className="rounded-lg p-2 text-[var(--color-text-subtle)] transition-all hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] active:scale-95"
        title="Delete set"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

interface CompletionButtonProps {
  canComplete: boolean
  missingText: string | null
  onToggleComplete: () => void
}

export function CompletionButton({ canComplete, missingText, onToggleComplete }: CompletionButtonProps) {
  return (
    <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
      {missingText && (
        <p className="text-xs font-medium text-[var(--color-danger)] text-center">{missingText}</p>
      )}
      <div className="flex justify-end">
        <button
          onClick={onToggleComplete}
          disabled={!canComplete}
          className={cn(
            "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98]",
            canComplete
              ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)]"
              : "bg-[var(--color-surface-muted)] text-[var(--color-text-subtle)] cursor-not-allowed opacity-60"
          )}
        >
          <Check size={16} strokeWidth={2.5} />
          <span>Mark Complete</span>
        </button>
      </div>
    </div>
  )
}

interface DumbbellToggleProps {
  show: boolean
  hasError: boolean
  isEditing: boolean
  hasImplementCount: boolean
  implementCount?: number | null
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void
  onErrorClear: () => void
}

export function DumbbellToggle({
  show, hasError, isEditing, hasImplementCount, implementCount, onUpdate, onErrorClear
}: DumbbellToggleProps) {
  if (!show) return null
  return (
    <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-4 py-2.5">
      <span className="text-xs font-medium text-subtle">How many dumbbells?</span>
      <div className={cn(
        "grid grid-cols-2 rounded-lg border p-0.5 transition-all w-28",
        hasError ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)]/40" : "border-[var(--color-border)] bg-[var(--color-surface)]"
      )}>
        {[1, 2].map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => { onUpdate('implementCount', count as 1 | 2); onUpdate('loadType', 'per_implement'); onErrorClear() }}
            className={cn(
              "h-8 rounded-md text-xs font-semibold transition-all",
              hasImplementCount && implementCount === count
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
            )}
            disabled={!isEditing}
          >
            {count} DB
          </button>
        ))}
      </div>
    </div>
  )
}

/** Total weight display bar. */
export function TotalWeightBar({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-4 py-2.5">
      <span className="text-xs font-medium text-subtle">Total Weight</span>
      <span className="text-sm font-bold text-strong">{label}</span>
    </div>
  )
}
