'use client'

import React, { useMemo, useState, memo } from 'react'
import type { WorkoutSet, MetricProfile, WeightUnit, LoadType } from '@/types/domain'
import { Trash2, Check } from 'lucide-react'
import { RPE_OPTIONS } from '@/constants/intensityOptions'
import type { WeightOption } from '@/lib/equipment'
import { mapRirToRpe, formatTotalWeightLabel } from '@/lib/session-metrics'
import { useSetEditor } from '@/hooks/useSetEditor'
import { cn } from '@/lib/utils'
import { FastRepsInput, FastRirInput, FastRestInput } from './FastEntryControls'

interface SetLoggerProps {
  set: WorkoutSet
  weightOptions?: WeightOption[]
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void
  onDelete: () => void
  onToggleComplete: () => void
  metricProfile?: MetricProfile
  isCardio?: boolean
  isMobility?: boolean
  isTimeBased?: boolean
  repsLabel?: string
}

// Compact summary shown when set is completed
const CompletedSetSummary = memo(function CompletedSetSummary({
  set,
  effectiveProfile,
  effectiveLoadType,
  unitLabel,
  onToggleComplete,
  onDelete,
  getExtra,
  durationMinutes
}: {
  set: WorkoutSet
  effectiveProfile: string
  effectiveLoadType: LoadType | null
  unitLabel: WeightUnit
  onToggleComplete: () => void
  onDelete: () => void
  getExtra: (key: string) => unknown
  durationMinutes: string | number
}) {
  const derivedRpe = typeof set.rir === 'number' ? mapRirToRpe(set.rir) : set.rpe

  // Calculate simple weight display (just the number)
  const simpleWeight = typeof set.weight === 'number' ? `${set.weight} ${unitLabel}` : null
  
  // Calculate load (weight × reps = tonnage for the set)
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

    // Default strength profile: Weight, Load, Reps, RPE
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

// Small pill for displaying completed set metrics
const MetricPill = memo(function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs">
      <span className="font-medium text-[var(--color-text-subtle)]">{label}:</span>
      <span className="font-semibold text-[var(--color-text)]">{value}</span>
    </span>
  )
})

/**
 * SetLogger component for logging individual workout sets.
 * Redesigned to match the app's visual standards with:
 * - Consistent typography (text-xs text-subtle labels)
 * - Proper spacing (gap-3, gap-4 patterns)
 * - Compact completed state
 * - Proportional input sizing
 */
const SetLoggerComponent: React.FC<SetLoggerProps> = ({
  set,
  weightOptions,
  onUpdate,
  onDelete,
  onToggleComplete,
  metricProfile,
  isCardio = false,
  isMobility = false,
  isTimeBased = false,
  repsLabel = 'Reps'
}) => {
  const [implementError, setImplementError] = useState(false)

  const {
    isEditing,
    effectiveProfile,
    weightError,
    repsError,
    validateAndUpdate,
    updateExtra,
    getExtra,
    weightChoices,
    durationMinutes,
    handleDurationChange,
    restMinutes,
    handleRestChange
  } = useSetEditor({
    set,
    metricProfile,
    weightOptions,
    isCardio,
    isMobility,
    isTimeBased,
    onUpdate
  })

  const unitLabel: WeightUnit = set.weightUnit ?? 'lb'
  const hasImplementCount = typeof set.implementCount === 'number' && (set.implementCount === 1 || set.implementCount === 2)
  
  // Determine the equipment kind of the currently selected weight
  // First check extraMetrics (set when user selects from dropdown), then fallback to matching by value
  const selectedEquipmentKind = useMemo(() => {
    const storedKind = (set.extraMetrics as Record<string, unknown> | null)?.equipmentKind
    if (typeof storedKind === 'string') return storedKind
    if (typeof set.weight !== 'number' || !weightOptions) return null
    const match = weightOptions.find(opt => opt.value === set.weight)
    return match?.equipmentKind ?? null
  }, [set.weight, weightOptions, set.extraMetrics])
  
  // Show dumbbell toggle only when a dumbbell weight is actually selected
  const showDumbbellToggle = selectedEquipmentKind === 'dumbbell'
  
  const effectiveLoadType: LoadType = set.loadType === 'per_implement'
    ? 'per_implement'
    : (showDumbbellToggle && hasImplementCount ? 'per_implement' : 'total')

  const totalWeightLabel = useMemo(() => {
    // Hide total weight display for bodyweight (0) or invalid weight
    if (typeof set.weight !== 'number' || !Number.isFinite(set.weight) || set.weight === 0) return null
    return formatTotalWeightLabel({
      weight: set.weight,
      weightUnit: unitLabel,
      displayUnit: unitLabel,
      loadType: effectiveLoadType,
      implementCount: hasImplementCount ? set.implementCount as number : null
    })
  }, [set.weight, unitLabel, effectiveLoadType, hasImplementCount, set.implementCount])

  // Compute missing fields for validation (reactive, not just on click)
  const missingFields = useMemo(() => {
    const missing: string[] = []
    
    // Check dumbbell toggle requirement first
    if (showDumbbellToggle && !hasImplementCount) {
      missing.push('dumbbells')
    }
    
    if (['mobility_session', 'cardio_session', 'timed_strength'].includes(effectiveProfile)) {
      if (!durationMinutes || Number(durationMinutes) <= 0) missing.push('duration')
    }

    if (effectiveProfile === 'strength') {
      // Reps is required for strength exercises
      if (set.reps === null || set.reps === undefined || set.reps === '' || set.reps === 0) missing.push('reps')
      // Weight is required for strength exercises (must be explicitly selected, not just "--")
      if (typeof set.weight !== 'number') missing.push('weight')
      // RIR is required for strength exercises
      if (typeof set.rir !== 'number') missing.push('rir')
      // Rest is required for strength exercises (must be set, assuming 0 is valid but null/undefined is not)
      if (set.restSecondsActual === null || set.restSecondsActual === undefined) missing.push('rest')
    }

    if (effectiveProfile === 'timed_strength') {
      // Weight is required for timed strength (must be explicitly selected)
      if (typeof set.weight !== 'number') missing.push('weight')
      // Rest is required for timed strength
      if (set.restSecondsActual === null || set.restSecondsActual === undefined) missing.push('rest')
    }
    
    if (effectiveProfile === 'cardio_session') {
      const dist = getExtra('distance_km') ?? set.distance
      if (dist === null || dist === undefined || dist === '') missing.push('distance')
    }

    return missing
  }, [effectiveProfile, durationMinutes, set.reps, set.weight, set.rir, set.distance, getExtra, showDumbbellToggle, hasImplementCount, set.restSecondsActual])

  // Check if set can be marked complete
  const canComplete = missingFields.length === 0

  // If completed, show compact summary
  if (set.completed) {
    return (
      <div className="mb-3">
        <CompletedSetSummary
          set={set}
          effectiveProfile={effectiveProfile}
          effectiveLoadType={effectiveLoadType}
          unitLabel={unitLabel}
          onToggleComplete={onToggleComplete}
          onDelete={onDelete}
          getExtra={getExtra}
          durationMinutes={durationMinutes}
        />
      </div>
    )
  }

  // Form input styles - consistent with Input/Select components
  const inputBaseClass = cn(
    'input-base h-11 text-sm font-medium text-center',
    "disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-input-muted)]"
  )

  const inputErrorClass = (hasError?: boolean) => cn(
    inputBaseClass,
    hasError && "border-[var(--color-danger)] ring-2 ring-[var(--color-danger-soft)]"
  )

  // Compact input for small numeric values (reps, RIR, rest)
  const inputCompactClass = cn(
    'input-base input-compact h-11 w-16 text-sm font-medium text-center',
    "disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-input-muted)]"
  )

  // Compact select for small value dropdowns (RIR)
  const selectCompactClass = cn(
    'input-base h-11 w-20 text-sm font-medium text-center',
    "disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-input-muted)]"
  )

  const labelClass = "text-xs font-medium text-subtle"

  const handleToggleComplete = () => {
    if (set.completed) {
      onToggleComplete()
      return
    }

    // Check dumbbell toggle requirement
    if (showDumbbellToggle && !hasImplementCount) {
      setImplementError(true)
      return
    }
    setImplementError(false)

    // Only allow completion if all required fields are valid
    if (!canComplete) return

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12)
    }

    onToggleComplete()
  }

  // Generate human-readable list of missing fields
  const getMissingFieldsText = () => {
    if (missingFields.length === 0) return null
    const fieldLabels: Record<string, string> = {
      duration: 'Duration',
      reps: 'Reps',
      weight: 'Weight',
      rir: 'RIR',
      distance: 'Distance',
      dumbbells: 'Dumbbell count',
      rest: 'Rest'
    }
    const labels = missingFields.map(f => fieldLabels[f] || f)
    if (labels.length === 1) return `${labels[0]} is required`
    const last = labels.pop()
    return `${labels.join(', ')} and ${last} are required`
  }

  const renderHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-sm font-bold text-[var(--color-text)] border border-[var(--color-border)]">
          {set.setNumber}
        </div>
        <span className="text-sm font-semibold text-muted">Set {set.setNumber}</span>
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

  const renderCompletionButton = () => {
    const missingText = getMissingFieldsText()
    
    return (
      <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
        {missingText && (
          <p className="text-xs font-medium text-[var(--color-danger)] text-center">
            {missingText}
          </p>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleToggleComplete}
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

  const renderDumbbellToggle = () => {
    if (!showDumbbellToggle) return null
    
    return (
      <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-4 py-2.5">
        <span className="text-xs font-medium text-subtle">How many dumbbells?</span>
        <div className={cn(
          "grid grid-cols-2 rounded-lg border p-0.5 transition-all w-28",
          implementError ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)]/40" : "border-[var(--color-border)] bg-[var(--color-surface)]"
        )}>
          {[1, 2].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => { onUpdate('implementCount', count as 1 | 2); onUpdate('loadType', 'per_implement'); setImplementError(false) }}
              className={cn(
                "h-8 rounded-md text-xs font-semibold transition-all",
                hasImplementCount && set.implementCount === count
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

  // Mobility Session Form
  if (effectiveProfile === 'mobility_session') {
    return (
      <div className="surface-card mb-3 p-4">
        {renderHeader()}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Duration (min)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={durationMinutes}
              onChange={(e) => handleDurationChange(e.target.value)}
              className={inputErrorClass(missingFields.includes('duration'))}
              disabled={!isEditing}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Intensity (1-10)</label>
            <select
              value={set.rpe ?? ''}
              onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))}
              className={inputBaseClass}
              disabled={!isEditing}
            >
              <option value="">--</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Category</label>
            <select
              value={(getExtra('style') as string) ?? ''}
              onChange={(e) => updateExtra('style', e.target.value)}
              className={inputBaseClass}
              disabled={!isEditing}
            >
              <option value="">Select</option>
              <option value="Flow">Flow</option>
              <option value="Power">Power</option>
              <option value="Restorative">Restorative</option>
              <option value="Yin">Yin</option>
              <option value="Mobility">Mobility</option>
              <option value="Breathwork">Breathwork</option>
            </select>
          </div>
        </div>
        {renderCompletionButton()}
      </div>
    )
  }

  // Cardio Session Form
  if (effectiveProfile === 'cardio_session') {
    return (
      <div className="surface-card mb-3 p-4">
        {renderHeader()}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Duration (min)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={durationMinutes}
              onChange={(e) => handleDurationChange(e.target.value)}
              className={inputErrorClass(missingFields.includes('duration'))}
              disabled={!isEditing}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Intensity (1-10)</label>
            <select
              value={set.rpe ?? ''}
              onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))}
              className={inputBaseClass}
              disabled={!isEditing}
            >
              <option value="">--</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Distance (km)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={(getExtra('distance_km') as string) ?? set.distance ?? ''}
              onChange={(e) => {
                validateAndUpdate('distance', e.target.value)
                const num = e.target.value === '' ? null : Number(e.target.value)
                if (!isNaN(num as number)) updateExtra('distance_km', num)
              }}
              className={inputErrorClass(missingFields.includes('distance'))}
              disabled={!isEditing}
            />
          </div>
        </div>
        {renderCompletionButton()}
      </div>
    )
  }

  // Timed Strength Form
  if (effectiveProfile === 'timed_strength') {
    return (
      <div className="surface-card mb-3 p-4">
        {renderHeader()}
        
        <div className="flex flex-wrap items-end gap-3">
          {/* Weight - primary field, takes available space */}
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <label className={labelClass}>
              {effectiveLoadType === 'per_implement' ? `Wt/DB (${unitLabel})` : `Weight (${unitLabel})`}
            </label>
            {weightChoices.length > 0 ? (
              <select
                value={weightChoices.find(c => c.value === set.weight && c.equipmentKind === selectedEquipmentKind)?.key ?? ''}
                onChange={(e) => {
                  const selectedKey = e.target.value
                  if (selectedKey === '') {
                    onUpdate('weight', '')
                    updateExtra('equipmentKind', null)
                    return
                  }
                  const opt = weightChoices.find(c => c.key === selectedKey)
                  if (opt) {
                    onUpdate('weight', opt.value)
                    if (opt.unit) onUpdate('weightUnit', opt.unit)
                    updateExtra('equipmentKind', opt.equipmentKind ?? null)
                  }
                }}
                className={inputErrorClass(missingFields.includes('weight'))}
                disabled={!isEditing}
              >
                <option value="">--</option>
                {weightChoices.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={set.weight ?? ''}
                onChange={(e) => validateAndUpdate('weight', e.target.value)}
                className={inputErrorClass(weightError || missingFields.includes('weight'))}
                disabled={!isEditing}
              />
            )}
          </div>

          {/* Duration - compact numeric field */}
          <div className="flex w-20 shrink-0 flex-col gap-1.5">
            <label className={labelClass}>Duration</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={durationMinutes}
                onChange={(e) => handleDurationChange(e.target.value)}
                className={cn(inputCompactClass, "w-12", missingFields.includes('duration') && "border-[var(--color-danger)] ring-2 ring-[var(--color-danger-soft)]")}
                disabled={!isEditing}
              />
              <span className="text-xs text-subtle">min</span>
            </div>
          </div>

          {/* RPE - compact dropdown */}
          <div className="flex w-16 shrink-0 flex-col gap-1.5">
            <label className={labelClass}>RPE</label>
            <select
              value={typeof set.rpe === 'number' ? String(set.rpe) : ''}
              onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))}
              className={selectCompactClass}
              disabled={!isEditing}
            >
              <option value="">--</option>
              {RPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.value}</option>
              ))}
            </select>
          </div>

          {/* Rest - Fast Timer Input */}
          <div className="flex w-32 shrink-0 flex-col gap-1.5">
            <label className={labelClass}>Rest</label>
            <FastRestInput
              value={restMinutes}
              onChange={handleRestChange}
              disabled={!isEditing}
            />
          </div>
        </div>

        {renderDumbbellToggle()}

        {totalWeightLabel && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-4 py-2.5">
            <span className="text-xs font-medium text-subtle">Total Weight</span>
            <span className="text-sm font-bold text-strong">{totalWeightLabel}</span>
          </div>
        )}
        
        {renderCompletionButton()}
      </div>
    )
  }

  // Default Strength Form
  const derivedRpe = typeof set.rir === 'number' ? mapRirToRpe(set.rir) : null
  const derivedRpeLabel = RPE_OPTIONS.find((opt) => opt.value === derivedRpe)?.label ?? null

  return (
    <div className="surface-card mb-3 p-4">
      {renderHeader()}
      
      <div className="flex flex-wrap items-end gap-3">
        {/* Weight - primary field, takes available space */}
        <div className="flex min-w-[120px] flex-1 flex-col gap-1.5">
          <label className={labelClass}>
            {effectiveLoadType === 'per_implement' ? `Wt/DB (${unitLabel})` : `Weight (${unitLabel})`}
          </label>
          {weightChoices.length > 0 ? (
            <select
              value={weightChoices.find(c => c.value === set.weight && c.equipmentKind === selectedEquipmentKind)?.key ?? ''}
              onChange={(e) => {
                const selectedKey = e.target.value
                if (selectedKey === '') {
                  onUpdate('weight', '')
                  updateExtra('equipmentKind', null)
                  return
                }
                const opt = weightChoices.find(c => c.key === selectedKey)
                if (opt) {
                  onUpdate('weight', opt.value)
                  if (opt.unit) onUpdate('weightUnit', opt.unit)
                  updateExtra('equipmentKind', opt.equipmentKind ?? null)
                }
              }}
              className={inputErrorClass(missingFields.includes('weight'))}
              disabled={!isEditing}
            >
              <option value="">--</option>
              {weightChoices.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={set.weight ?? ''}
              onChange={(e) => validateAndUpdate('weight', e.target.value)}
              className={inputErrorClass(weightError || missingFields.includes('weight'))}
              disabled={!isEditing}
            />
          )}
        </div>

        {/* Reps - Fast Stepper Input */}
        <div className="flex w-32 shrink-0 flex-col gap-1.5">
          <label className={labelClass}>{repsLabel}</label>
          <FastRepsInput
            value={set.reps ?? ''}
            onChange={(val) => validateAndUpdate('reps', val)}
            disabled={!isEditing}
            className={cn((repsError || missingFields.includes('reps')) && "ring-2 ring-[var(--color-danger-soft)] border-[var(--color-danger)]")}
          />
        </div>

        {/* RIR - Fast Segmented Control */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label className={labelClass} title="Reps in Reserve – How many more reps could you have done?">
            RIR (Reps in Reserve)
          </label>
          <FastRirInput
            value={set.rir ?? ''}
            onChange={(val) => { onUpdate('rir', val); onUpdate('rpe', '') }}
            disabled={!isEditing}
            className={cn(missingFields.includes('rir') && "ring-2 ring-[var(--color-danger-soft)] border-[var(--color-danger)]")}
          />
        </div>

        {/* Rest - Fast Timer Input */}
        <div className="flex w-32 shrink-0 flex-col gap-1.5">
          <label className={labelClass}>Rest</label>
          <FastRestInput
            value={restMinutes}
            onChange={handleRestChange}
            disabled={!isEditing}
          />
        </div>
      </div>

      {/* RPE derivation hint - shown below fields when RIR is set */}
      {derivedRpe && (
        <p className="mt-2 text-[10px] font-medium text-subtle">
          RPE {derivedRpe}{derivedRpeLabel ? ` · ${derivedRpeLabel}` : ''}
        </p>
      )}

      {renderDumbbellToggle()}

      {totalWeightLabel && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-4 py-2.5">
          <span className="text-xs font-medium text-subtle">Total Weight</span>
          <span className="text-sm font-bold text-strong">{totalWeightLabel}</span>
        </div>
      )}
      
      {renderCompletionButton()}
    </div>
  )
}

// Export memoized component to prevent unnecessary re-renders
export const SetLogger = memo(SetLoggerComponent)
