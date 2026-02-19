'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatDateTime } from '@/lib/transformers/chart-data'
import { formatSessionDisplayTitle } from '@/lib/workout-naming'
import { toMuscleLabel } from '@/lib/muscle-utils'
import type { SessionRow } from '@/hooks/useDashboardData'

interface RecentActivityProps {
  recentSessions: SessionRow[]
}

export function RecentActivity({ recentSessions }: RecentActivityProps) {
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})

  const handleToggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }))
  }

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
            const sessionTitle = session.name
            const isExpanded = Boolean(expandedSessions[session.id])
            return (
              <div
                key={session.id}
                className="group flex flex-col gap-6 rounded-2xl border border-[var(--color-border)] p-6 transition-all hover:bg-[var(--color-surface-subtle)] hover:shadow-md"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-lg font-bold text-strong">{formatSessionDisplayTitle(sessionTitle, session.started_at, session.ended_at)}</p>
                    <div className="flex items-center gap-4 text-sm text-subtle">
                      <span className="font-medium">{formatDateTime(session.started_at)}</span>
                    </div>
                  </div>
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => handleToggleSession(session.id)}
                    className="font-bold group-hover:bg-[var(--color-surface)] group-hover:shadow-sm"
                  >
                    {isExpanded ? 'Hide' : 'Details'}
                    {isExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
                {isExpanded && (
                  <div className="space-y-4 border-t border-[var(--color-border)]/60 pt-5 animate-in slide-in-from-top-4 duration-300">
                    {session.session_exercises.length === 0 ? (
                      <p className="text-sm text-muted">No exercises logged for this session yet.</p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {session.session_exercises.map((exercise) => {
                          const completedSets = exercise.sets?.filter((set) => set.completed !== false).length ?? 0
                          return (
                            <div
                              key={exercise.id}
                              className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-strong truncate">{exercise.exercise_name}</p>
                                <p className="text-xs text-subtle">
                                  {exercise.primary_muscle ? `Primary: ${toMuscleLabel(exercise.primary_muscle)}` : 'Primary: N/A'}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-subtle/70">
                                {completedSets} set{completedSets === 1 ? '' : 's'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
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
