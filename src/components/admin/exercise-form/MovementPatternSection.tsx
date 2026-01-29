'use client'

import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { MOVEMENT_PATTERNS, MOVEMENT_PATTERN_MUSCLES } from './constants'
import type { Exercise, MovementPattern } from '@/types/domain'

type MuscleOption = { slug: string; label: string }

type Props = {
  formData: Partial<Exercise>
  muscleOptions: MuscleOption[]
  onPatternChange: (pattern: MovementPattern | undefined) => void
  onPrimaryMuscleChange: (muscle: string | undefined, updates: Partial<Exercise>) => void
}

/**
 * Movement pattern and primary muscle selection for strength exercises
 */
export function MovementPatternSection({ 
  formData, 
  muscleOptions, 
  onPatternChange,
  onPrimaryMuscleChange 
}: Props) {
  // Patterns that support the current primary muscle
  const availablePatterns = MOVEMENT_PATTERNS.filter(p => {
    if (!formData.primaryMuscle) return true
    return MOVEMENT_PATTERN_MUSCLES[p.value]?.includes(formData.primaryMuscle as string)
  })

  // Primary muscles that belong to the current pattern
  const availablePrimaryMuscles = muscleOptions.filter(m => {
    if (m.slug === 'full_body') return false
    if (!formData.movementPattern) return true
    return MOVEMENT_PATTERN_MUSCLES[formData.movementPattern as string]?.includes(m.slug)
  })

  return (
    <div className="col-span-12 space-y-8 animate-in fade-in duration-500">
      {/* Movement Pattern */}
      <div>
        <Label className="mb-3 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">
          Movement Pattern
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MOVEMENT_PATTERNS.map(pattern => {
            const isSelected = formData.movementPattern === pattern.value
            const isAvailable = availablePatterns.some(p => p.value === pattern.value)
            
            return (
              <button
                key={pattern.value}
                type="button"
                onClick={() => onPatternChange(isSelected ? undefined : pattern.value as MovementPattern)}
                className={cn(
                  "py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 min-h-[48px]",
                  isSelected
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md"
                    : isAvailable 
                      ? "bg-white/50 border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                      : "bg-white/10 border-dashed border-[var(--color-border)] text-[var(--color-text-subtle)] opacity-50 cursor-not-allowed"
                )}
              >
                {pattern.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Primary Muscle */}
      <div>
        <Label className="mb-3 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">
          Primary Muscle
        </Label>
        <div className="flex flex-wrap gap-2">
          {availablePrimaryMuscles.map(m => {
            const isSelected = formData.primaryMuscle === m.slug
            return (
              <button
                key={m.slug}
                type="button"
                onClick={() => {
                  const val = isSelected ? undefined : m.slug
                  const updates: Partial<Exercise> = { primaryMuscle: val }
                  
                  if (val === 'full_body') {
                    updates.secondaryMuscles = muscleOptions
                      .map(mo => mo.slug)
                      .filter(s => s !== 'full_body')
                  } else if (formData.primaryMuscle === 'full_body' && val !== 'full_body') {
                    updates.secondaryMuscles = []
                  } else if (val && formData.secondaryMuscles?.includes(val)) {
                    updates.secondaryMuscles = formData.secondaryMuscles.filter(sm => sm !== val)
                  }
                  
                  onPrimaryMuscleChange(val, updates)
                }}
                className={cn(
                  "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border-2 min-h-[40px]",
                  isSelected 
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md" 
                    : "bg-white/30 border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                )}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
