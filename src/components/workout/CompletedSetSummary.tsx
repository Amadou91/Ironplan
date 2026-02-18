'use client'

import React, { useMemo, memo } from 'react'
import type { WorkoutSet, WeightUnit, LoadType } from '@/types/domain'
import { Trash2, Check } from 'lucide-react'
import { mapRirToRpe } from '@/lib/session-metrics'

/** Small pill for displaying completed set metrics */
export const MetricPill = memo(function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs">
      <span className="font-medium text-[var(--color-text-subtle)]">{label}:</span>
      <span className="font-semibold text-[var(--color-text)]">{value}</span>
    </span>
  )
})

interface CompletedSetSummaryProps {
  set: WorkoutSet
  effectiveProfile: string
  effectiveLoadType: LoadType | null
  unitLabel: WeightUnit
  onToggleComplete: () => void
  onDelete: () => void
  getExtra: (key: string) => unknown
  durationMinutes: string | number
}

/** Compact summary shown when a set is completed */
export const CompletedSetSummary = memo(function CompletedSetSummary({
  set,
  effectiveProfile,
  effectiveLoadType,
  unitLabel,
  onToggleComplete,
  onDelete,
  getExtra,
  durationMinutes
}: CompletedSetSummaryProps) {
  const derivedRpe = typeof set.rir === 'number' ? mapRirToRpe(set.rir) : set.rpe

  const simpleWeight = typeof set.weight === 'number' ? `${set.weight} ${unitLabel}` : null

  const load = useMemo(() => {
    if (typeof set.weight !== 'number' || typeof set.reps !== 'number') return null
    const hasImpl = typeof set.implementCount === 'number' && (set.implementCount === 1 || set.implementCount === 2)
    const multiplier = effectiveLoadType === 'per_implement' && hasImpl ? set.implementCount as number : 1
    const totalWeight = set.weight * multiplier
    return totalWeight * set.reps
  }, [set.weight, set.reps, set.implementCount, effectiveLoadType])

  const renderMetrics = () => {
    if (effectiveProfile === 'mobility_session') {
      return (
        <>
          <MetricPill label="Duration" value={`${durationMinutes} min`} />
          {set.rpe && <MetricPill label="Intensity" value={String(set.rpe)} />}
          {getExtra('style') && <MetricPill label="Style" value={String(getExtra('style'))} />}
        </>
      )
    }

    if (effectiveProfile === 'cardio_session') {
      return (
        <>
          <MetricPill label="Duration" value={`${durationMinutes} min`} />
          {set.rpe && <MetricPill label="Intensity" value={String(set.rpe)} />}
          {(getExtra('distance_km') ?? set.distance) && (
            <MetricPill label="Distance" value={`${getExtra('distance_km') ?? set.distance} km`} />
          )}
        </>
      )
    }

    if (effectiveProfile === 'timed_strength') {
      return (
        <>
          <MetricPill label="Duration" value={`${durationMinutes} min`} />
          {simpleWeight && <MetricPill label="Weight" value={simpleWeight} />}
          {derivedRpe && <MetricPill label="RPE" value={String(derivedRpe)} />}
        </>
      )
    }

    // Default strength profile
    return (
      <>
        {simpleWeight && <MetricPill label="Weight" value={simpleWeight} />}
        {load && <MetricPill label="Load" value={`${load} ${unitLabel}`} />}
        {set.reps && <MetricPill label="Reps" value={String(set.reps)} />}
        {derivedRpe && <MetricPill label="RPE" value={String(derivedRpe)} />}
      </>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-soft)]/20 px-4 py-3 transition-all">
      {/* Set Number */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success)]/20 text-sm font-bold text-[var(--color-success)]">
        {set.setNumber}
      </div>

      {/* Metrics Summary */}
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {renderMetrics()}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleComplete}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-success)] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[var(--color-success-strong)] active:scale-95"
          title="Edit set"
        >
          <Check size={14} strokeWidth={3} />
          <span className="hidden sm:inline">Logged</span>
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-[var(--color-text-subtle)] transition-all hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] active:scale-95"
          title="Delete set"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
})
