'use client'

import type { Goal } from '@/types/domain'

const styleOptions: { value: Goal; label: string; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Heavier loads, lower reps, power focus.' },
  { value: 'hypertrophy', label: 'Hypertrophy', description: 'Muscle growth with balanced volume.' },
  { value: 'endurance', label: 'Endurance & Cardio', description: 'Higher reps and conditioning focus.' }
]

interface GoalSelectorProps {
  value: Goal
  onChange: (value: Goal) => void
}

export function GoalSelector({ value, onChange }: GoalSelectorProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-strong">Training style</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Goal)}
        className="input-base"
      >
        {styleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
