'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Trash2 } from 'lucide-react'
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
    <Card className="glass-panel">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
        <div>
          <h2 className="text-xl font-black text-strong tracking-tight uppercase">Session Logs</h2>
          <p className="text-[11px] font-bold text-subtle uppercase tracking-widest mt-1">Review your historical data</p>
        </div>
        <span className="text-[10px] font-black text-subtle/60 uppercase tracking-widest bg-[var(--color-surface-muted)] px-3 py-1 rounded-lg border border-[var(--color-border)]">{sessions.length} session(s)</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]/50">
        {sessions.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted font-medium italic">No sessions logged for this range yet.</div>
        ) : (
          sessions.map((session) => {
            const totals = getSessionTotals(session)
            const isExpanded = Boolean(expandedSessions[session.id])
            return (
              <div key={session.id} className="space-y-5 p-6 transition-all hover:bg-[var(--color-surface-subtle)]/40 group">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-base font-black text-strong tracking-tight group-hover:text-[var(--color-primary)] transition-colors">{getSessionTitle(session)}</p>
                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold text-subtle uppercase tracking-wider">
                      <span className="text-strong opacity-80">{formatDateTime(session.started_at)}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-border-strong)] opacity-30" />
                      <span>{formatDuration(session.started_at, session.ended_at)}</span>
                      {session.body_weight_lb && (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-border-strong)] opacity-30" />
                          <span>{isKg ? Math.round(session.body_weight_lb * KG_PER_LB * 10) / 10 : session.body_weight_lb} {displayUnit} BW</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-lg bg-[var(--color-bg)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-subtle/80 border border-[var(--color-border)] shadow-sm">{totals.exercises} exercises</span>
                    <span className="inline-flex items-center rounded-lg bg-[var(--color-bg)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-subtle/80 border border-[var(--color-border)] shadow-sm">{totals.sets} sets</span>
                    <span className="inline-flex items-center rounded-lg bg-[var(--color-bg)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-subtle/80 border border-[var(--color-border)] shadow-sm">{Math.round(isKg ? totals.volume * KG_PER_LB : totals.volume).toLocaleString()} {displayUnit} vol</span>
                    <span className="inline-flex items-center rounded-lg bg-[var(--color-primary-soft)]/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--color-primary-strong)] border border-[var(--color-primary-border)]/30 shadow-sm">{Math.round(totals.workload).toLocaleString()} load</span>
                    <span className="inline-flex items-center rounded-lg bg-[var(--color-success-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--color-success-strong)] border border-[var(--color-success-border)] shadow-sm">{totals.hardSets} hard sets</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/sessions/${session.id}/edit`}>
                      <Button variant="outline" className="h-10 px-4 text-[11px] font-black uppercase tracking-widest border-2">Edit</Button>
                    </Link>
                    <Button
                      type="button"
                      onClick={() => handleToggleSession(session.id)}
                      className="h-10 px-4 text-[11px] font-black uppercase tracking-widest"
                      variant="secondary"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      className="h-10 w-10 p-0 border-2 border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      variant="outline"
                      disabled={Boolean(deletingSessionIds[session.id])}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="space-y-4 pt-4 border-t border-[var(--color-border)]/30 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid gap-4 md:grid-cols-2">
                      {session.session_exercises.map((exercise) => (
                        <div key={exercise.id} className="surface-card-muted p-5 rounded-2xl border border-[var(--color-border)] transition-all hover:bg-[var(--color-surface-muted)]/50">
                          <p className="text-sm font-black text-strong uppercase tracking-tight mb-3">{exercise.exercise_name}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[10px] font-bold uppercase tracking-widest text-subtle/70">
                            <p>Primary: <span className="text-strong">{exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'N/A'}</span></p>
                            {exercise.secondary_muscles && exercise.secondary_muscles.length > 0 && (
                              <p>Secondary: <span className="text-strong">{exercise.secondary_muscles.map((muscle: string) => toMuscleLabel(muscle)).join(', ')}</span></p>
                            )}
                          </div>
                          <div className="space-y-2">
                            {(exercise.sets ?? []).map((set) => {
                              const weightVal = set.weight ?? 0;
                              const fromUnit = (set.weight_unit as WeightUnit) || 'lb';
                              const displayWeight = Math.round(convertWeight(weightVal, fromUnit, displayUnit) * 10) / 10;
                              
                              return (
                                <div key={set.id} className="rounded-xl border border-[var(--color-border)]/50 bg-[var(--color-surface-subtle)]/50 px-3 py-2.5 transition-colors hover:border-[var(--color-border-strong)]">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-subtle/60">Set {set.set_number ?? 'N/A'}</span>
                                    <div className="text-xs font-black text-strong">
                                      {set.weight ? `${displayWeight} ${displayUnit}` : 'N/A'} <span className="text-[var(--color-border-strong)] font-normal mx-1">×</span> {set.reps ?? 'N/A'}
                                      <span className="ml-2 text-[10px] text-subtle tracking-normal">
                                        {typeof set.rpe === 'number' ? ` RPE ${set.rpe}` : ''}
                                        {typeof set.rir === 'number' ? ` RIR ${set.rir}` : ''}
                                      </span>
                                    </div>
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
        <div className="border-t border-[var(--color-border)] px-6 py-6 text-center">
          <Button
            variant="secondary"
            onClick={onLoadMore}
            disabled={loading}
            className="h-12 px-10 text-[11px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95"
          >
            {loading ? 'Loading...' : 'Load more sessions'}
          </Button>
        </div>
      )}
    </Card>
  )
}
