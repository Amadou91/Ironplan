'use client'

import type { FocusArea } from '@/types/domain'

const focusOptions: { value: FocusArea; label: string; description?: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Yoga / Mobility' }
]

interface MuscleGroupSelectorProps {
  selectedFocus: FocusArea | undefined
  onFocusChange: (focus: FocusArea) => void
}

export function MuscleGroupSelector({ selectedFocus, onFocusChange }: MuscleGroupSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {focusOptions.map((option) => {
        const isSelected = selectedFocus === option.value
        
        // Dynamic styling based on focus type
        let baseColors = ''
        let selectedColors = ''
        
        if (option.value === 'mobility') {
          // Yoga - Gentle Emerald
          baseColors = 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40 text-strong hover:border-emerald-500/30 hover:bg-emerald-500/[0.02]'
          selectedColors = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-4 ring-emerald-500/20'
        } else if (option.value === 'cardio') {
          // Cardio - Friendly Purple
          baseColors = 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40 text-strong hover:border-purple-500/30 hover:bg-purple-500/[0.02]'
          selectedColors = 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-4 ring-purple-500/20'
        } else {
          // Muscle - Soft Blue
          baseColors = 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40 text-strong hover:border-blue-500/30 hover:bg-blue-500/[0.02]'
          selectedColors = 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-4 ring-blue-500/20'
        }

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onFocusChange(option.value)}
            className={`rounded-xl border px-4 py-5 text-center transition-all duration-200 ${
              isSelected ? selectedColors : baseColors
            }`}
            aria-pressed={isSelected}
          >
            <p className="text-sm font-bold uppercase tracking-wide">{option.label}</p>
          </button>
        )
      })}
    </div>
  )
}
