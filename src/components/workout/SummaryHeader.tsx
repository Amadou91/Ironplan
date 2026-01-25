import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface SummaryHeaderProps {
  title: string
  dateLabel: string
  durationLabel: string
  bodyWeight: number | null
  onBodyWeightUpdate: (val: string) => void
  intensityLabel?: string | null
  minutesPlanned?: number | null
  readinessScore?: number | null
  isLb?: boolean
}

export function SummaryHeader({
  title,
  dateLabel,
  durationLabel,
  bodyWeight,
  onBodyWeightUpdate,
  intensityLabel,
  minutesPlanned,
  readinessScore,
  isLb = true
}: SummaryHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-success)]">Workout complete</p>
        <h1 className="font-display text-3xl font-semibold text-strong">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {dateLabel} · {durationLabel}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-1.5">
            <span className="text-xs font-medium text-subtle">Body weight:</span>
            <input
              type="text"
              inputMode="decimal"
              step="0.1"
              placeholder={isLb ? "lb" : "kg"}
              value={bodyWeight ?? ''}
              onChange={(e) => onBodyWeightUpdate(e.target.value)}
              className="w-16 bg-transparent text-sm font-semibold text-strong outline-none"
            />
            <span className="text-[10px] text-subtle">{isLb ? "lb" : "kg"}</span>
          </div>
        </div>
        {(intensityLabel || minutesPlanned || typeof readinessScore === 'number') && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
            {intensityLabel && <span className="badge-neutral">Intensity: {intensityLabel}</span>}
            {minutesPlanned && <span className="badge-neutral">{minutesPlanned} min plan</span>}
            {typeof readinessScore === 'number' && <span className="badge-neutral">Readiness {readinessScore}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard">
          <Button size="sm">Back to Today</Button>
        </Link>
        <Link href="/progress">
          <Button variant="secondary" size="sm">View Progress</Button>
        </Link>
      </div>
    </div>
  )
}
