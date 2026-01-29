'use client'

import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { MOVEMENT_PATTERN_MUSCLES } from './constants'
import type { Exercise } from '@/types/domain'

type MuscleOption = { slug: string; label: string }

type Props = {
  formData: Partial<Exercise>
  muscleOptions: MuscleOption[]
  onSecondaryMuscleToggle: (slug: string) => void
}

/**
 * Secondary muscles selection for strength exercises
 * Splits muscles into "logical" (based on movement pattern) and "other"
 */
export function SecondaryMusclesSection({ 
  formData, 
  muscleOptions, 
  onSecondaryMuscleToggle 
}: Props) {
  // Muscles logical to the current movement pattern
  const logicalSecondaryMuscles = muscleOptions.filter(m => {
    if (m.slug === 'full_body') return false
    if (m.slug === formData.primaryMuscle) return false
    if (!formData.movementPattern) return true
    return MOVEMENT_PATTERN_MUSCLES[formData.movementPattern as string]?.includes(m.slug)
  })

  // Muscles outside the current pattern
  const otherSecondaryMuscles = muscleOptions.filter(m => {
    if (m.slug === formData.primaryMuscle) return false
    if (!formData.movementPattern) return false
    return !MOVEMENT_PATTERN_MUSCLES[formData.movementPattern as string]?.includes(m.slug) && 
           !['full_body', 'cardio', 'mobility'].includes(m.slug)
  })

  if (formData.primaryMuscle === 'full_body') {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label className="block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">
          Secondary Muscles (Optional)
        </Label>
        
        {/* Suggested Muscles based on Pattern */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
            Logical to {formData.movementPattern || 'Selection'}
          </span>
          <div className="flex flex-wrap gap-2">
            {logicalSecondaryMuscles.map(m => {
              const isSelected = formData.secondaryMuscles?.includes(m.slug)
              return (
                <button
                  type="button"
                  key={m.slug}
                  onClick={() => onSecondaryMuscleToggle(m.slug)}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border-2 min-h-[40px]",
                    isSelected 
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] border-[var(--color-primary-border)] shadow-sm" 
                      : "bg-white/30 border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                  )}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Other Muscles */}
        {otherSecondaryMuscles.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--color-border)]/30">
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
              Other Muscles
            </span>
            <div className="flex flex-wrap gap-2">
              {otherSecondaryMuscles.map(m => {
                const isSelected = formData.secondaryMuscles?.includes(m.slug)
                return (
                  <button
                    type="button"
                    key={m.slug}
                    onClick={() => onSecondaryMuscleToggle(m.slug)}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border border-[var(--color-border)] min-h-[36px]",
                      isSelected 
                        ? "bg-[var(--color-surface-muted)] text-[var(--color-text)] border-[var(--color-border-strong)]" 
                        : "bg-white/10 text-[var(--color-text-subtle)] hover:border-[var(--color-border-strong)]"
                    )}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
