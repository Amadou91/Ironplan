import React from 'react'
import { toMuscleLabel } from '@/lib/muscle-utils'

interface ExerciseHighlight {
  name: string
  muscle: string | null
  volume: number
}

interface ExerciseHighlightsProps {
  highlights: ExerciseHighlight[]
}

export function ExerciseHighlights({ highlights }: ExerciseHighlightsProps) {
  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-[0.2em] text-subtle">Top exercises</p>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {highlights.map((exercise) => (
          <div key={exercise.name} className="flex flex-col justify-between rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm">
            <div>
              <p className="font-semibold text-strong">{exercise.name}</p>
              <p className="text-xs text-subtle">{exercise.muscle ? toMuscleLabel(exercise.muscle) : 'Primary muscle'}</p>
            </div>
            <span className="mt-2 text-sm text-muted font-medium">{exercise.volume} tonnage</span>
          </div>
        ))}
        {highlights.length === 0 && (
          <p className="text-sm text-muted">No completed sets logged.</p>
        )}
      </div>
    </div>
  )
}
