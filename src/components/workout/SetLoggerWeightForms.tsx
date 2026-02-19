'use client'

import React from 'react'
import type { WorkoutSet, WeightUnit, LoadType } from '@/types/domain'
import type { WeightOption } from '@/lib/equipment'
import { RPE_OPTIONS } from '@/constants/intensityOptions'
import { mapRirToRpe } from '@/lib/session-metrics'
import { cn } from '@/lib/utils'
import { FastRepsInput, FastRirInput, FastRestInput } from '@/components/workout/FastEntryControls'
import { TotalWeightBar } from '@/components/workout/SetLoggerControls'

const INPUT_BASE = cn(
  'input-base h-12 text-lg font-mono font-bold text-center',
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-input-muted)]'
)
const inputError = (hasError?: boolean) => cn(
  INPUT_BASE,
  hasError && 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger-soft)]'
)
const INPUT_COMPACT = cn(
  'input-base input-compact h-12 w-20 text-lg font-mono font-bold text-center',
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-input-muted)]'
)
const SELECT_COMPACT = cn(
  'input-base h-12 w-24 text-base font-medium text-center',
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-input-muted)]'
)

const LABEL = 'text-xs font-semibold text-muted mb-1 block'
interface SetFormBaseProps {
  set: WorkoutSet
  isEditing: boolean
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void
  missingFields: string[]
  header: React.ReactNode
  completionButton: React.ReactNode
}
/** Renders a weight selector (dropdown or freeform input). */
function WeightField({
  set, isEditing, missingFields, weightChoices, selectedEquipmentKind,
  effectiveLoadType, unitLabel, weightError, validateAndUpdate, updateExtra, onUpdate, minWidth = '120px'
}: {
  set: WorkoutSet
  isEditing: boolean
  missingFields: string[]
  weightChoices: WeightOption[]
  selectedEquipmentKind: string | null
  effectiveLoadType: LoadType
  unitLabel: WeightUnit
  weightError: boolean
  validateAndUpdate: (field: keyof WorkoutSet, value: string) => void
  updateExtra: (key: string, value: unknown) => void
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void
  minWidth?: string
}) {
  return (
    <div className={`flex flex-1 flex-col gap-1.5`} style={{ minWidth }}>
      <label className={LABEL}>
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
          className={inputError(missingFields.includes('weight'))}
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
          className={inputError(weightError || missingFields.includes('weight'))}
          disabled={!isEditing}
        />
      )}
    </div>
  )
}
interface TimedStrengthFormProps extends SetFormBaseProps {
  durationMinutes: string | number
  handleDurationChange: (value: string) => void
  weightChoices: WeightOption[]
  selectedEquipmentKind: string | null
  effectiveLoadType: LoadType
  unitLabel: WeightUnit
  weightError: boolean
  validateAndUpdate: (field: keyof WorkoutSet, value: string) => void
  updateExtra: (key: string, value: unknown) => void
  restMinutes: string | number
  handleRestChange: (value: string) => void
  totalWeightLabel: string | null
  dumbbellToggle: React.ReactNode
}
export function TimedStrengthForm({
  set, isEditing, onUpdate, missingFields,
  durationMinutes, handleDurationChange,
  weightChoices, selectedEquipmentKind, effectiveLoadType, unitLabel,
  weightError, validateAndUpdate, updateExtra,
  restMinutes, handleRestChange,
  totalWeightLabel, dumbbellToggle,
  header, completionButton
}: TimedStrengthFormProps) {
  return (
    <div className="surface-card mb-3 p-4">
      {header}
      <div className="flex flex-wrap items-end gap-3">
        <WeightField
          set={set} isEditing={isEditing} missingFields={missingFields}
          weightChoices={weightChoices} selectedEquipmentKind={selectedEquipmentKind}
          effectiveLoadType={effectiveLoadType} unitLabel={unitLabel}
          weightError={weightError} validateAndUpdate={validateAndUpdate}
          updateExtra={updateExtra} onUpdate={onUpdate} minWidth="140px"
        />
        <div className="flex w-20 shrink-0 flex-col gap-1.5">
          <label className={LABEL}>Duration</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={durationMinutes}
              onChange={(e) => handleDurationChange(e.target.value)}
              className={cn(INPUT_COMPACT, 'w-12', missingFields.includes('duration') && 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger-soft)]')}
              disabled={!isEditing}
            />
            <span className="text-xs text-subtle">min</span>
          </div>
        </div>
        <div className="flex w-16 shrink-0 flex-col gap-1.5">
          <label className={LABEL}>RPE</label>
          <select
            value={typeof set.rpe === 'number' ? String(set.rpe) : ''}
            onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))}
            className={cn(SELECT_COMPACT, missingFields.includes('rpe') && 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger-soft)]')}
            disabled={!isEditing}
          >
            <option value="">--</option>
            {RPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.value}</option>
            ))}
          </select>
        </div>
        <div className="flex w-32 shrink-0 flex-col gap-1.5">
          <label className={LABEL}>Rest</label>
          <FastRestInput value={restMinutes} onChange={handleRestChange} disabled={!isEditing} />
        </div>
      </div>
      {dumbbellToggle}
      {totalWeightLabel && <TotalWeightBar label={totalWeightLabel} />}
      {completionButton}
    </div>
  )
}
interface DefaultStrengthFormProps extends SetFormBaseProps {
  weightChoices: WeightOption[]
  selectedEquipmentKind: string | null
  effectiveLoadType: LoadType
  unitLabel: WeightUnit
  weightError: boolean
  repsError: boolean
  validateAndUpdate: (field: keyof WorkoutSet, value: string) => void
  updateExtra: (key: string, value: unknown) => void
  restMinutes: string | number
  handleRestChange: (value: string) => void
  repsLabel: string
  totalWeightLabel: string | null
  dumbbellToggle: React.ReactNode
}
export function DefaultStrengthForm({
  set, isEditing, onUpdate, missingFields,
  weightChoices, selectedEquipmentKind, effectiveLoadType, unitLabel,
  weightError, repsError, validateAndUpdate, updateExtra,
  restMinutes, handleRestChange,
  repsLabel, totalWeightLabel, dumbbellToggle,
  header, completionButton
}: DefaultStrengthFormProps) {
  const derivedRpe = typeof set.rir === 'number' ? mapRirToRpe(set.rir) : null
  const derivedRpeLabel = RPE_OPTIONS.find((opt) => opt.value === derivedRpe)?.label ?? null

  return (
    <div className="surface-card mb-3 p-4">
      {header}
      <div className="flex flex-wrap items-end gap-3">
        <WeightField
          set={set} isEditing={isEditing} missingFields={missingFields}
          weightChoices={weightChoices} selectedEquipmentKind={selectedEquipmentKind}
          effectiveLoadType={effectiveLoadType} unitLabel={unitLabel}
          weightError={weightError} validateAndUpdate={validateAndUpdate}
          updateExtra={updateExtra} onUpdate={onUpdate}
        />
        <div className="flex w-32 shrink-0 flex-col gap-1.5">
          <label className={LABEL}>{repsLabel}</label>
          <FastRepsInput
            value={set.reps ?? ''}
            onChange={(val) => validateAndUpdate('reps', val)}
            disabled={!isEditing}
            className={cn((repsError || missingFields.includes('reps')) && 'ring-2 ring-[var(--color-danger-soft)] border-[var(--color-danger)]')}
          />
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label className={LABEL} title="Reps in Reserve – How many more reps could you have done?">
            RIR (Reps in Reserve)
          </label>
          <FastRirInput
            value={set.rir ?? ''}
            onChange={(val) => { onUpdate('rir', val); onUpdate('rpe', '') }}
            disabled={!isEditing}
            className={cn(missingFields.includes('rir') && 'ring-2 ring-[var(--color-danger-soft)] border-[var(--color-danger)]')}
          />
        </div>
        <div className="flex w-32 shrink-0 flex-col gap-1.5">
          <label className={LABEL}>Rest</label>
          <FastRestInput value={restMinutes} onChange={handleRestChange} disabled={!isEditing} />
        </div>
      </div>
      {derivedRpe && (
        <p className="mt-2 text-xs font-medium text-subtle">
          RPE {derivedRpe}{derivedRpeLabel ? ` · ${derivedRpeLabel}` : ''}
        </p>
      )}
      {dumbbellToggle}
      {totalWeightLabel && <TotalWeightBar label={totalWeightLabel} />}
      {completionButton}
    </div>
  )
}
