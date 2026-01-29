'use client'

import { Dumbbell, Heart, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExerciseType } from './constants'

type Props = {
  value: ExerciseType
  onChange: (type: ExerciseType) => void
}

const TYPE_OPTIONS = [
  { id: 'Strength' as const, icon: Dumbbell, label: 'Strength' },
  { id: 'Yoga' as const, icon: Activity, label: 'Yoga / Mobility' },
  { id: 'Cardio' as const, icon: Heart, label: 'Cardio' },
]

/**
 * High-level exercise type toggle (Strength / Yoga / Cardio)
 */
export function ExerciseTypeToggle({ value, onChange }: Props) {
  return (
    <div className="flex p-2 bg-[var(--color-surface-muted)] rounded-2xl border border-[var(--color-border)] shadow-inner">
      {TYPE_OPTIONS.map((type) => {
        const Icon = type.icon
        const isSelected = value === type.id
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => onChange(type.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl font-bold transition-all duration-300 min-h-[56px]",
              isSelected 
                ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-md ring-1 ring-[var(--color-border-strong)] scale-[1.02]" 
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="hidden sm:inline">{type.label}</span>
            <span className="sm:hidden">{type.label.split(' ')[0]}</span>
          </button>
        )
      })}
    </div>
  )
}
