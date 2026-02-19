'use client'

import React from 'react'
import type { WorkoutSet } from '@/types/domain'
import { cn } from '@/lib/utils'

const INPUT_BASE = cn(
  'input-base h-11 text-sm font-medium text-center',
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-input-muted)]'
)

const inputError = (hasError?: boolean) => cn(
  INPUT_BASE,
  hasError && 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger-soft)]'
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

interface MobilityFormProps extends SetFormBaseProps {
  durationMinutes: string | number
  handleDurationChange: (value: string) => void
  getExtra: (key: string) => unknown
  updateExtra: (key: string, value: unknown) => void
}

export function MobilityForm({
  set, isEditing, onUpdate, missingFields,
  durationMinutes, handleDurationChange, getExtra, updateExtra,
  header, completionButton
}: MobilityFormProps) {
  return (
    <div className="surface-card mb-3 p-4">
      {header}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Duration (min)</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={durationMinutes}
            onChange={(e) => handleDurationChange(e.target.value)}
            className={inputError(missingFields.includes('duration'))}
            disabled={!isEditing}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Intensity (1-10)</label>
          <select
            value={set.rpe ?? ''}
            onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))}
            className={inputError(missingFields.includes('rpe'))}
            disabled={!isEditing}
          >
            <option value="">--</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Category</label>
          <select
            value={(getExtra('style') as string) ?? ''}
            onChange={(e) => updateExtra('style', e.target.value)}
            className={inputError(missingFields.includes('style'))}
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
      {completionButton}
    </div>
  )
}

interface CardioFormProps extends SetFormBaseProps {
  durationMinutes: string | number
  handleDurationChange: (value: string) => void
  getExtra: (key: string) => unknown
  updateExtra: (key: string, value: unknown) => void
  validateAndUpdate: (field: keyof WorkoutSet, value: string) => void
}

export function CardioForm({
  set, isEditing, onUpdate, missingFields,
  durationMinutes, handleDurationChange, getExtra, updateExtra, validateAndUpdate,
  header, completionButton
}: CardioFormProps) {
  return (
    <div className="surface-card mb-3 p-4">
      {header}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Duration (min)</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={durationMinutes}
            onChange={(e) => handleDurationChange(e.target.value)}
            className={inputError(missingFields.includes('duration'))}
            disabled={!isEditing}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Intensity (1-10)</label>
          <select
            value={set.rpe ?? ''}
            onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))}
            className={inputError(missingFields.includes('rpe'))}
            disabled={!isEditing}
          >
            <option value="">--</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Distance (km)</label>
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
            className={inputError(missingFields.includes('distance'))}
            disabled={!isEditing}
          />
        </div>
      </div>
      {completionButton}
    </div>
  )
}
