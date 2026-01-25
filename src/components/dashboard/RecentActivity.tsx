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
    <Card className="p-8 md:p-10 lg:p-12">
      <div className="flex items-center gap-4 mb-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-strong shadow-sm">
          <Clock className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-strong uppercase tracking-wider">Recent Activity</h2>
          <p className="text-sm text-muted">Review your most recent completed sessions.</p>
        </div>
      </div>

      <div className="space-y-4">
        {recentSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center text-base text-muted">
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
                className="group flex flex-col gap-6 rounded-2xl border border-[var(--color-border)] p-6 transition-all hover:bg-[var(--color-surface-subtle)] hover:shadow-md md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1.5">
                  <p className="text-lg font-bold text-strong">{sessionTitle}</p>
                  <div className="flex items-center gap-4 text-sm text-subtle">
                    <span className="font-medium">{formatDateTime(session.started_at)}</span>
                    <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />
                    <span>{formatDuration(session.started_at, session.ended_at)}</span>
                  </div>
                </div>
                <Link href={`/sessions/${session.id}/edit`}>
                  <Button
                    size="md"
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

      <div className="mt-10 pt-8 border-t border-[var(--color-border)]">
        <Link href="/progress" className="text-base font-bold text-accent hover:underline flex items-center gap-2">
          View all training history <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </Card>
  )
}
