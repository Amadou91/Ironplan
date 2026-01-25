'use client'

import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { formatDateTime, formatDuration } from '@/lib/transformers/chart-data'
import type { SessionRow, TemplateRow } from '@/hooks/useDashboardData'

interface RecentActivityProps {
  recentSessions: SessionRow[]
  templateById: Map<string, TemplateRow>
}

export function RecentActivity({ recentSessions, templateById }: RecentActivityProps) {
  return (
    <Card className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-strong">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-strong uppercase tracking-wider">Recent Activity</h2>
          <p className="text-xs text-muted">Review your most recent completed sessions.</p>
        </div>
      </div>

      <div className="space-y-3">
        {recentSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-muted">
            No activity history yet.
          </div>
        ) : (
          recentSessions.map((session) => {
            const template = session.template_id ? templateById.get(session.template_id) : null
            const sessionTitle =
              template && session.name === template.title
                ? buildWorkoutDisplayName({
                    focus: template.focus,
                    style: template.style,
                    intensity: template.intensity,
                    minutes: typeof session.minutes_available === 'number' ? session.minutes_available : null,
                    fallback: session.name,
                    cardioExerciseName:
                      template.style === 'cardio' && session.session_exercises?.[0]?.exercise_name
                        ? session.session_exercises[0].exercise_name
                        : null
                  })
                : session.name

            return (
              <div
                key={session.id}
                className="group flex flex-col gap-4 rounded-xl border border-[var(--color-border)] p-5 transition-all hover:bg-[var(--color-surface-subtle)] md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-bold text-strong">{sessionTitle}</p>
                  <div className="flex items-center gap-3 text-xs text-subtle">
                    <span className="font-medium">{formatDateTime(session.started_at)}</span>
                    <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />
                    <span>{formatDuration(session.started_at, session.ended_at)}</span>
                  </div>
                </div>
                <Link href={`/sessions/${session.id}/edit`}>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="font-bold group-hover:bg-[var(--color-surface)] group-hover:shadow-sm"
                  >
                    Review Logs
                  </Button>
                </Link>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
        <Link href="/progress" className="text-sm font-bold text-accent hover:underline flex items-center gap-2">
          View all training history <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  )
}
