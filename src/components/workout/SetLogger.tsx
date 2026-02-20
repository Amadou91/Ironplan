'use client'

import React, { useMemo, useState, memo } from 'react'
import type { WorkoutSet, MetricProfile, WeightUnit, LoadType } from '@/types/domain'
import type { WeightOption } from '@/lib/equipment'
import { formatTotalWeightLabel } from '@/lib/session-metrics'
import { useSetEditor } from '@/hooks/useSetEditor'
import { CompletedSetSummary } from '@/components/workout/CompletedSetSummary'
import { MobilityForm, CardioForm } from '@/components/workout/SetLoggerSimpleForms'
import { TimedStrengthForm, DefaultStrengthForm } from '@/components/workout/SetLoggerWeightForms'
import { SetLoggerHeader, CompletionButton, DumbbellToggle } from '@/components/workout/SetLoggerControls'

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

/**
 * SetLogger component for logging individual workout sets.
 * Delegates to profile-specific form sub-components for input rendering.
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

  const selectedEquipmentKind = useMemo(() => {
    const storedKind = (set.extraMetrics as Record<string, unknown> | null)?.equipmentKind
    if (typeof storedKind === 'string') return storedKind
    const match = typeof set.weight === 'number' && weightOptions?.find(opt => opt.value === set.weight)
    return match ? match.equipmentKind ?? null : null
  }, [set.weight, weightOptions, set.extraMetrics])

  const showDumbbellToggle = selectedEquipmentKind === 'dumbbell'
  
  const effectiveLoadType: LoadType = set.loadType === 'per_implement'
    ? 'per_implement'
    : (showDumbbellToggle && hasImplementCount ? 'per_implement' : 'total')

  const totalWeightLabel = useMemo(() => {
    if (typeof set.weight !== 'number' || !Number.isFinite(set.weight) || set.weight === 0) return null
    return formatTotalWeightLabel({ weight: set.weight, weightUnit: unitLabel, displayUnit: unitLabel, loadType: effectiveLoadType, implementCount: hasImplementCount ? set.implementCount as number : null })
  }, [set.weight, unitLabel, effectiveLoadType, hasImplementCount, set.implementCount])

  const missingFields = useMemo(() => {
    const m: string[] = []
    if (showDumbbellToggle && !hasImplementCount) m.push('dumbbells')
    if (['mobility_session', 'cardio_session', 'timed_strength'].includes(effectiveProfile)) {
      if (!durationMinutes || Number(durationMinutes) <= 0) m.push('duration')
    }
    if (effectiveProfile === 'strength') {
      if (typeof set.reps !== 'number' || set.reps <= 0) m.push('reps')
      if (typeof set.weight !== 'number') m.push('weight')
      if (typeof set.rir !== 'number') m.push('rir')
    }
    if (effectiveProfile === 'timed_strength') {
      if (typeof set.weight !== 'number') m.push('weight')
      if (typeof set.rpe !== 'number') m.push('rpe')
    }
    if (effectiveProfile === 'cardio_session') {
      if (typeof set.rpe !== 'number') m.push('rpe')
      if (!(getExtra('distance_km') ?? set.distance)) m.push('distance')
    }
    if (effectiveProfile === 'mobility_session') {
      if (typeof set.rpe !== 'number') m.push('rpe')
      if (!getExtra('style')) m.push('style')
    }
    return m
  }, [effectiveProfile, durationMinutes, set.reps, set.weight, set.rir, set.rpe, set.distance, getExtra, showDumbbellToggle, hasImplementCount, set.restSecondsActual])

  const canComplete = missingFields.length === 0

  if (set.completed) {
    return (
      <div className="mb-3">
        <CompletedSetSummary
          set={set} effectiveProfile={effectiveProfile} effectiveLoadType={effectiveLoadType}
          unitLabel={unitLabel} onToggleComplete={onToggleComplete} onDelete={onDelete}
          getExtra={getExtra} durationMinutes={durationMinutes}
        />
      </div>
    )
  }

  const handleToggleComplete = () => {
    if (set.completed) { onToggleComplete(); return }
    if (showDumbbellToggle && !hasImplementCount) { setImplementError(true); return }
    setImplementError(false)
    if (!canComplete) return
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12)
    onToggleComplete()
  }

  const getMissingFieldsText = () => {
    if (!missingFields.length) return null
    const map: Record<string, string> = { duration: 'Duration', reps: 'Reps', weight: 'Weight', rir: 'RIR', rpe: 'Intensity', distance: 'Distance', dumbbells: 'Dumbbell count', rest: 'Rest', style: 'Category' }
    const labels = missingFields.map(f => map[f] || f)
    return labels.length === 1 ? `${labels[0]} is required` : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)} are required`
  }

  const header = <SetLoggerHeader setNumber={set.setNumber} onDelete={onDelete} />
  const completionButton = (
    <CompletionButton canComplete={canComplete} missingText={getMissingFieldsText()} onToggleComplete={handleToggleComplete} />
  )
  const dumbbellToggle = (
    <DumbbellToggle
      show={showDumbbellToggle} hasError={implementError} isEditing={isEditing}
      hasImplementCount={hasImplementCount} implementCount={typeof set.implementCount === 'number' ? set.implementCount : null}
      onUpdate={onUpdate} onErrorClear={() => setImplementError(false)}
    />
  )

  const baseProps = { set, isEditing, onUpdate, missingFields, header, completionButton }

  if (effectiveProfile === 'mobility_session') {
    return (
      <MobilityForm
        {...baseProps}
        durationMinutes={durationMinutes}
        handleDurationChange={handleDurationChange}
        getExtra={getExtra}
        updateExtra={updateExtra}
      />
    )
  }

  if (effectiveProfile === 'cardio_session') {
    return (
      <CardioForm
        {...baseProps}
        durationMinutes={durationMinutes}
        handleDurationChange={handleDurationChange}
        getExtra={getExtra}
        updateExtra={updateExtra}
        validateAndUpdate={validateAndUpdate}
      />
    )
  }

  if (effectiveProfile === 'timed_strength') {
    return (
      <TimedStrengthForm
        {...baseProps}
        durationMinutes={durationMinutes}
        handleDurationChange={handleDurationChange}
        weightChoices={weightChoices}
        selectedEquipmentKind={selectedEquipmentKind}
        effectiveLoadType={effectiveLoadType}
        unitLabel={unitLabel}
        weightError={weightError}
        validateAndUpdate={validateAndUpdate}
        updateExtra={updateExtra}
        restMinutes={restMinutes}
        handleRestChange={handleRestChange}
        totalWeightLabel={totalWeightLabel}
        dumbbellToggle={dumbbellToggle}
      />
    )
  }

  // Default Strength Form
  return (
    <DefaultStrengthForm
      {...baseProps}
      weightChoices={weightChoices}
      selectedEquipmentKind={selectedEquipmentKind}
      effectiveLoadType={effectiveLoadType}
      unitLabel={unitLabel}
      weightError={weightError}
      repsError={repsError}
      validateAndUpdate={validateAndUpdate}
      updateExtra={updateExtra}
      restMinutes={restMinutes}
      handleRestChange={handleRestChange}
      repsLabel={repsLabel}
      totalWeightLabel={totalWeightLabel}
      dumbbellToggle={dumbbellToggle}
    />
  )
}

// Export memoized component to prevent unnecessary re-renders
export const SetLogger = memo(SetLoggerComponent)
