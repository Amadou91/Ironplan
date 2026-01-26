'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { 
  formatDateTime, 
  formatDuration 
} from '@/lib/transformers/chart-data'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { 
  aggregateHardSets, 
  computeSetTonnage, 
  computeSetLoad, 
  computeSetE1rm 
} from '@/lib/session-metrics'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB, LBS_PER_KG, convertWeight } from '@/lib/units'
import type { SessionRow } from '@/lib/transformers/progress-data'
import type { Goal, Exercise, FocusArea, PlanInput, WeightUnit } from '@/types/domain'

export type TemplateRow = {
  id: string
  title: string
  focus: FocusArea
  style: PlanInput['goals']['primary']
  intensity: PlanInput['intensity']
  template_inputs: PlanInput | null
}

interface SessionHistoryListProps {
  sessions: SessionRow[]
  templateById: Map<string, TemplateRow>
  exerciseLibraryByName: Map<string, Exercise>
  getSessionTitle: (session: SessionRow) => string
  hasMore: boolean
  onLoadMore: () => void
  onDeleteSuccess: (sessionId: string) => void
  onError: (msg: string) => void
  loading: boolean
}

export function SessionHistoryList({
  sessions,
  templateById,
  exerciseLibraryByName,
  getSessionTitle,
  hasMore,
  onLoadMore,
  onDeleteSuccess,
  onError,
  loading
}: SessionHistoryListProps) {
  const supabase = createClient()
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'
  const [deletingSessionIds, setDeletingSessionIds] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return
    setDeletingSessionIds((prev) => ({ ...prev, [sessionId]: true }))
    try {
      const { error: deleteError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
      if (deleteError) throw deleteError
      onDeleteSuccess(sessionId)
    } catch (deleteError) {
      console.error('Failed to delete session', deleteError)
      onError('Unable to delete the session. Please try again.')
    } finally {
      setDeletingSessionIds((prev) => ({ ...prev, [sessionId]: false }))
    }
  }

  const handleToggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }))
  }

  const getSessionTotals = (session: SessionRow) => {
    const totals = {
      exercises: session.session_exercises.length,
      sets: 0,
      reps: 0,
      volume: 0,
      hardSets: 0,
      bestE1rm: 0,
      workload: 0
    }
    const template = session.template_id ? templateById.get(session.template_id) : null
    const sessionGoal = template?.style as Goal | undefined

    session.session_exercises.forEach((exercise) => {
      const isEligible = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())?.e1rmEligible

      exercise.sets.forEach((set) => {
        if (set.completed === false) return
        totals.sets += 1
        const reps = set.reps ?? 0
        totals.reps += reps
        const tonnage = computeSetTonnage({
          metricProfile: exercise.metric_profile ?? undefined,
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
        })
        totals.volume += tonnage
        totals.hardSets += aggregateHardSets([
          {
            metricProfile: exercise.metric_profile ?? undefined,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null
          }
        ])
        totals.workload += computeSetLoad({
          metricProfile: exercise.metric_profile ?? undefined,
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
          rpe: typeof set.rpe === 'number' ? set.rpe : null,
          rir: typeof set.rir === 'number' ? set.rir : null,
          durationSeconds: set.duration_seconds ?? null
        })

        const e1rm = computeSetE1rm(
          {
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            completed: set.completed
          },
          sessionGoal,
          isEligible
        )
        if (e1rm) totals.bestE1rm = Math.max(totals.bestE1rm, e1rm)
      })
    })
    return totals
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-strong">Previous Sessions</h2>
          <p className="text-xs text-subtle">Review and adjust your training logs.</p>
        </div>
        <span className="text-xs text-subtle">{sessions.length} session(s)</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {sessions.length === 0 ? (
          <div className="p-6 text-sm text-muted">No sessions logged for this range yet.</div>
        ) : (
          sessions.map((session) => {
            const totals = getSessionTotals(session)
            const isExpanded = Boolean(expandedSessions[session.id])
            return (
              <div key={session.id} className="space-y-4 p-6 transition-colors hover:bg-[var(--color-surface-subtle)]/30">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-strong tracking-tight">{getSessionTitle(session)}</p>
                    <div className="flex items-center gap-2 text-[11px] font-medium text-subtle">
                      <span>{formatDateTime(session.started_at)}</span>
                      <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />
                      <span>{formatDuration(session.started_at, session.ended_at)}</span>
                      {session.body_weight_lb && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />
                          <span>{isKg ? Math.round(session.body_weight_lb * KG_PER_LB * 10) / 10 : session.body_weight_lb} {displayUnit} BW</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                    <span className="inline-flex items-center rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 font-bold uppercase tracking-wider text-subtle border border-[var(--color-border)]">{totals.exercises} exercises</span>
                    <span className="inline-flex items-center rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 font-bold uppercase tracking-wider text-subtle border border-[var(--color-border)]">{totals.sets} sets</span>
                    <span className="inline-flex items-center rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 font-bold uppercase tracking-wider text-subtle border border-[var(--color-border)]">{totals.reps} reps</span>
                    <span className="inline-flex items-center rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 font-bold uppercase tracking-wider text-subtle border border-[var(--color-border)]">{Math.round(isKg ? totals.volume * KG_PER_LB : totals.volume).toLocaleString()} {displayUnit} vol</span>
                    <span className="inline-flex items-center rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 font-bold uppercase tracking-wider text-subtle border border-[var(--color-border)]">{Math.round(totals.workload).toLocaleString()} load</span>
                    <span className="inline-flex items-center rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 font-bold uppercase tracking-wider text-subtle border border-[var(--color-border)]">{totals.hardSets} hard sets</span>
                    <span className="inline-flex items-center rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 font-bold uppercase tracking-wider text-subtle border border-[var(--color-border)]">{Math.round(isKg ? totals.bestE1rm : totals.bestE1rm * LBS_PER_KG)} {displayUnit} e1RM</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/sessions/${session.id}/edit`}>
                      <Button variant="outline" className="h-8 px-3 text-xs">Edit</Button>
                    </Link>
                    <Button
                      type="button"
                      onClick={() => handleToggleSession(session.id)}
                      className="h-8 px-3 text-xs"
                      variant="secondary"
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      className="h-8 px-3 text-xs border border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      variant="outline"
                      disabled={Boolean(deletingSessionIds[session.id])}
                    >
                      {deletingSessionIds[session.id] ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      {session.session_exercises.map((exercise) => (
                        <div key={exercise.id} className="surface-card-muted p-4 text-xs text-muted">
                          <p className="text-sm font-semibold text-strong">{exercise.exercise_name}</p>
                          <p className="text-subtle">Primary: {exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'N/A'}</p>
                          <p className="text-subtle">Secondary: {exercise.secondary_muscles?.length ? exercise.secondary_muscles.map((muscle: string) => toMuscleLabel(muscle)).join(', ') : 'N/A'}</p>
                          <div className="mt-3 space-y-2">
                            {(exercise.sets ?? []).map((set) => {
                              const weightVal = set.weight ?? 0;
                              const fromUnit = (set.weight_unit as WeightUnit) || 'lb';
                              const displayWeight = Math.round(convertWeight(weightVal, fromUnit, displayUnit) * 10) / 10;
                              
                              return (
                                <div key={set.id} className="rounded border border-[var(--color-border)] px-2 py-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>Set {set.set_number ?? 'N/A'}</span>
                                    <span>
                                      {set.weight ? `${displayWeight} ${displayUnit}` : 'N/A'} × {set.reps ?? 'N/A'} reps
                                      {typeof set.rpe === 'number' ? ` · RPE ${set.rpe}` : ''}
                                      {typeof set.rir === 'number' ? ` · RIR ${set.rir}` : ''}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid gap-2 text-[10px] text-subtle sm:grid-cols-2">
                                    <span>Completed: {set.completed ? 'Yes' : 'No'}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      {hasMore && (
        <div className="border-t border-[var(--color-border)] px-6 py-4">
          <Button
            variant="secondary"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load more sessions'}
          </Button>
        </div>
      )}
    </Card>
  )
}
