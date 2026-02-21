'use client'

import React from 'react'

type ReadinessData = {
  sleep_quality: number
  muscle_soreness: number
  stress_level: number
  motivation: number
}

interface ReadinessSurveyProps {
  data: ReadinessData | null
  onChange: (data: ReadinessData) => void
}

export function ReadinessSurvey({ data, onChange }: ReadinessSurveyProps) {
  const readiness = data ?? { sleep_quality: 3, muscle_soreness: 3, stress_level: 3, motivation: 3 }

  const metrics = [
    { label: 'Sleep Quality', key: 'sleep_quality', minLabel: 'Poor', maxLabel: 'Excellent' },
    { label: 'Muscle Soreness', key: 'muscle_soreness', minLabel: 'None', maxLabel: 'Severe' },
    { label: 'Stress Level', key: 'stress_level', minLabel: 'Low', maxLabel: 'High' },
    { label: 'Motivation', key: 'motivation', minLabel: 'Low', maxLabel: 'High' }
  ]

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div key={metric.key}>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-strong">{metric.label}</label>
            <span className="text-sm font-bold text-[var(--color-primary)]">
              {readiness[metric.key as keyof ReadinessData]}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={readiness[metric.key as keyof ReadinessData]}
            onChange={(e) => onChange({ ...readiness, [metric.key]: parseInt(e.target.value) })}
            className="w-full h-2 bg-[var(--color-surface-muted)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
          />
          <div className="flex justify-between mt-1 text-[11px] text-subtle">
            <span>{metric.minLabel}</span>
            <span>{metric.maxLabel}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
