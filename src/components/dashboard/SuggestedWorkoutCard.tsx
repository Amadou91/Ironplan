'use client'

import { useMemo } from 'react'
import { ArrowRight, Brain, Zap, Battery, CalendarClock, Layers } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useWorkoutSuggestion } from '@/hooks/useWorkoutSuggestion'
import type { SessionRow } from '@/lib/transformers/progress-data'
import { toMuscleLabel } from '@/lib/muscle-utils'

interface SuggestedWorkoutCardProps {
  sessions: SessionRow[]
  onStart: (suggestion: any) => void
}

export function SuggestedWorkoutCard({ sessions, onStart }: SuggestedWorkoutCardProps) {
  const suggestion = useWorkoutSuggestion(sessions)

  if (!suggestion) return null

  const Icon = suggestion.intensity === 'low' ? Battery : suggestion.intensity === 'high' ? Zap : Layers

  return (
    <Card className="overflow-hidden border-l-4 border-l-[var(--color-primary)]">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]">
            <Brain className="h-4 w-4" />
            <span>AI Suggested Workout</span>
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-strong mb-1 capitalize">
              {suggestion.focus.map(f => toMuscleLabel(f)).join(' & ')} {suggestion.type === 'active_recovery' ? 'Recovery' : 'Session'}
            </h3>
            <p className="text-sm text-subtle max-w-xl">
              {suggestion.reasoning[0]}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mt-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-subtle bg-surface-muted px-2.5 py-1 rounded-md">
              <Icon className="h-3.5 w-3.5" />
              <span className="capitalize">{suggestion.intensity} Intensity</span>
            </div>
            {suggestion.reasoning.slice(1).map((reason, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-subtle bg-surface-muted px-2.5 py-1 rounded-md">
                <CalendarClock className="h-3.5 w-3.5" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0">
          <Button 
            size="lg" 
            className="w-full sm:w-auto shadow-lg shadow-[var(--color-primary)]/20"
            onClick={() => onStart(suggestion)}
          >
            Start Session <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
