'use client'

import Link from 'next/link'
import { Clock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { formatDateTime } from '@/lib/transformers/chart-data'
import type { TemplateRow } from '@/hooks/useDashboardData'

interface RecommendedSessionProps {
  recommendedTemplate: TemplateRow | undefined
  trainingLoadStatus: string
}

export function RecommendedSession({ recommendedTemplate, trainingLoadStatus }: RecommendedSessionProps) {
  return (
    <Card
      className={`overflow-hidden border-t-4 ${
        trainingLoadStatus === 'balanced'
          ? 'border-t-[var(--color-success)]'
          : trainingLoadStatus === 'overreaching'
            ? 'border-t-[var(--color-danger)]'
            : 'border-t-[var(--color-warning)]'
      }`}
    >
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-strong uppercase tracking-wider">Recommended for you</h2>
            <p className="text-xs text-muted">Intelligent suggestion based on your training history.</p>
          </div>
        </div>

        {recommendedTemplate ? (
          <div className="group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 transition-all hover:border-[var(--color-primary-border)] hover:bg-[var(--color-surface)] hover:shadow-md">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="badge-success text-[10px]">Best for Today</span>
                  <p className="text-xl font-bold text-strong">
                    {buildWorkoutDisplayName({
                      focus: recommendedTemplate.focus,
                      style: recommendedTemplate.style,
                      intensity: recommendedTemplate.intensity,
                      fallback: recommendedTemplate.title
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {recommendedTemplate.template_inputs?.time?.minutesPerSession ?? 45} min
                  </span>
                  <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />
                  <span>Created {formatDateTime(recommendedTemplate.created_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/workout/${recommendedTemplate.id}`}>
                  <Button variant="secondary" className="h-11 px-6">
                    Preview
                  </Button>
                </Link>
                <Link href={`/workouts/${recommendedTemplate.id}/start`}>
                  <Button className="h-11 px-8 shadow-lg shadow-[var(--color-primary-soft)]">Start Workout</Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[var(--color-border)] p-10 text-center">
            <p className="text-sm text-muted">Build your first plan to unlock daily recommendations.</p>
            <Link href="/generate" className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                Create Plan
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}
