'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import type { ReadinessSurvey } from '@/lib/training-metrics'

export const READINESS_FIELDS: Array<{
  key: keyof ReadinessSurvey
  label: string
  helper: string
}> = [
  { key: 'sleep', label: 'Sleep Quality', helper: '1 = poor, 5 = great' },
  { key: 'soreness', label: 'Muscle Soreness', helper: '1 = fresh, 5 = very sore' },
  { key: 'stress', label: 'Stress Level', helper: '1 = calm, 5 = high stress' },
  { key: 'motivation', label: 'Motivation', helper: '1 = low, 5 = high' }
]

type ReadinessSurveyDraft = {
  [Key in keyof ReadinessSurvey]: number | null
}

interface ReadinessCheckProps {
  survey: ReadinessSurveyDraft
  onUpdateField: (field: keyof ReadinessSurvey, value: number) => void
  score: number | null
  level: string | null
}

export function ReadinessCheck({
  survey,
  onUpdateField,
  score,
  level
}: ReadinessCheckProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-subtle">
        <span>Readiness check (required)</span>
        <span className="text-strong">
          {typeof score === 'number' ? `${score}/100 · ${level}` : 'Incomplete'}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">
        Rate each metric 1-5 before you can start the session.
      </p>
      <div className="mt-4 space-y-4">
        {READINESS_FIELDS.map((field) => (
          <div key={field.key} className="rounded-xl border border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-subtle">
              <span>{field.label}</span>
              <span>{survey[field.key] ?? 'N/A'}</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button
                  key={`${field.key}-${value}`}
                  type="button"
                  size="sm"
                  variant={survey[field.key] === value ? 'primary' : 'secondary'}
                  onClick={() => onUpdateField(field.key, value)}
                  className="h-9 w-full px-0 text-xs"
                >
                  {value}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-subtle">{field.helper}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
