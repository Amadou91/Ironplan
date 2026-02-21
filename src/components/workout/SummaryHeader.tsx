import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface SummaryHeaderProps {
  title: string
  dateLabel: string
  durationLabel: string
  bodyWeight: number | null
  onBodyWeightUpdate: (val: string) => void
  isSaving?: boolean
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
  isSaving = false,
  intensityLabel,
  minutesPlanned,
  readinessScore,
  isLb = true
}: SummaryHeaderProps) {
  // Use local state to allow typing decimals (parseFloat in parent would strip '.' while typing)
  const [localWeight, setLocalWeight] = React.useState(bodyWeight?.toString() ?? '')
  const [showSaved, setShowSaved] = React.useState(false)
  const prevIsSaving = React.useRef(isSaving)

  // Keep local state in sync with external prop changes
  React.useEffect(() => {
    setLocalWeight(bodyWeight?.toString() ?? '')
  }, [bodyWeight])

  // Show "Saved" briefly after saving completes
  React.useEffect(() => {
    if (prevIsSaving.current && !isSaving) {
      setShowSaved(true)
      const timer = setTimeout(() => setShowSaved(false), 2000)
      return () => clearTimeout(timer)
    }
    prevIsSaving.current = isSaving
  }, [isSaving])

  const handleChange = (val: string) => {
    // Allow digits and at most one decimal point
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setLocalWeight(val)
      onBodyWeightUpdate(val)
    }
  }

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
              placeholder={isLb ? "lb" : "kg"}
              value={localWeight}
              onChange={(e) => handleChange(e.target.value)}
              className="w-16 bg-transparent text-sm font-semibold text-strong outline-none"
            />
            <span className="text-[11px] text-subtle">{isLb ? "lb" : "kg"}</span>
          </div>
          <div className="min-w-[60px]">
            {isSaving ? (
              <span className="text-[11px] font-bold text-[var(--color-primary)] animate-pulse uppercase tracking-wider">Saving...</span>
            ) : showSaved ? (
              <span className="text-[11px] font-bold text-[var(--color-success)] uppercase tracking-wider">Saved</span>
            ) : null}
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
          <Button size="sm">Dashboard</Button>
        </Link>
        <Link href="/progress">
          <Button variant="secondary" size="sm">View Progress</Button>
        </Link>
      </div>
    </div>
  )
}
