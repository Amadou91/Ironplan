'use client'

import Link from 'next/link'
import { Clock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import type { TemplateRow } from '@/hooks/useDashboardData'

interface RecommendedSessionProps {
  recommendedTemplate: TemplateRow | undefined
}

export function RecommendedSession({ recommendedTemplate }: RecommendedSessionProps) {
  return (
    <Card className="overflow-hidden">
      <div className="p-8 md:p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-strong uppercase tracking-wider">Recommended for you</h2>
            <p className="text-sm text-muted">Intelligent suggestion based on your training history.</p>
          </div>
        </div>

        {recommendedTemplate ? (
          <div className="group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 transition-all hover:border-[var(--color-primary-border)] hover:bg-[var(--color-surface)] hover:shadow-md">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="badge-success text-[11px]">Best for Today</span>
                  <p className="text-2xl font-bold text-strong">
                    {buildWorkoutDisplayName({
                      focus: recommendedTemplate.focus,
                      style: recommendedTemplate.style,
                      intensity: recommendedTemplate.intensity,
                      fallback: recommendedTemplate.title
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-4 w-4" />
                    {recommendedTemplate.template_inputs?.time?.minutesPerSession ?? 45} min
                  </span>
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
