'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Trash2 } from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SessionHistoryToolbar } from '@/components/progress/SessionHistoryToolbar'
import { formatDateTime } from '@/lib/transformers/chart-data'
import { formatSessionDisplayTitle } from '@/lib/workout-naming'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { 
  aggregateHardSets, 
  computeSetTonnage, 
  computeSetLoad, 
  computeSetE1rm,
  formatTotalWeightLabel
} from '@/lib/session-metrics'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'
import type { SessionRow } from '@/lib/transformers/progress-data'
import type { Exercise, WeightUnit } from '@/types/domain'

interface SessionHistoryListProps {
  sessions: SessionRow[]
  exerciseLibraryByName: Map<string, Exercise>
  getSessionTitle: (session: SessionRow) => string
  hasMore: boolean
  onLoadMore: () => void
  onDeleteSuccess: (sessionId: string) => void
  onError: (msg: string) => void
  loading: boolean
  onImportSuccess?: () => void
  showActions?: boolean
  showImportExport?: boolean
  embedded?: boolean
}

export function SessionHistoryList({
  sessions,
  exerciseLibraryByName,
  getSessionTitle,
  hasMore,
  onLoadMore,
  onDeleteSuccess,
  onError,
  loading,
  onImportSuccess,
  showActions = true,
  showImportExport = true,
  embedded = false
}: SessionHistoryListProps) {
  const supabase = useSupabase()
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'
  const [deletingSessionIds, setDeletingSessionIds] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [sessionToDelete, setSessionToDelete] = useState<SessionRow | null>(null)

  const executeDeleteSession = async () => {
    if (!sessionToDelete) return
    const sessionId = sessionToDelete.id
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
      setSessionToDelete(null)
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

    session.session_exercises.forEach((exercise) => {
      const libEntry = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())
      const isEligible = libEntry?.e1rmEligible
      const movementPattern = libEntry?.movementPattern

      exercise.sets.forEach((set) => {
        if (set.completed === false) return
        totals.sets += 1
        const reps = set.reps ?? 0
        totals.reps += reps
        const tonnage = computeSetTonnage({
          metricProfile: exercise.metric_profile ?? undefined,
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          implementCount: set.implement_count ?? null,
          loadType: (set.load_type as 'total' | 'per_implement' | null) ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
        })
        totals.volume += tonnage
        totals.hardSets += aggregateHardSets([
          {
            metricProfile: exercise.metric_profile ?? undefined,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            implementCount: set.implement_count ?? null,
            loadType: (set.load_type as 'total' | 'per_implement' | null) ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null
          }
        ])
        totals.workload += computeSetLoad({
          metricProfile: exercise.metric_profile ?? undefined,
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          implementCount: set.implement_count ?? null,
          loadType: (set.load_type as 'total' | 'per_implement' | null) ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
          rpe: typeof set.rpe === 'number' ? set.rpe : null,
          rir: typeof set.rir === 'number' ? set.rir : null,
          durationSeconds: set.duration_seconds ?? null
        })

        const e1rm = computeSetE1rm(
          {
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            implementCount: set.implement_count ?? null,
            loadType: (set.load_type as 'total' | 'per_implement' | null) ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            completed: set.completed
          },
          null,
          isEligible,
          movementPattern
        )
        if (e1rm) totals.bestE1rm = Math.max(totals.bestE1rm, e1rm)
      })
    })
    return totals
  }

  const metricBadgeBaseClass =
    'inline-flex h-7 items-center rounded-lg px-2.5 py-0 text-[11px] leading-none font-semibold uppercase tracking-[0.06em] whitespace-nowrap shadow-sm'

  const listContent = (
    <>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 sm:px-5 ${embedded ? 'py-3.5' : 'py-4'}`}>
        {embedded ? (
          <div className="min-w-0">
            <p className="type-overline text-subtle">Session history tools</p>
            <p className="mt-1 type-meta text-subtle">Most recent first. Expand any session to review full set details.</p>
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className="type-section-title text-strong">Session logs</h2>
            <p className="mt-1 type-meta text-subtle">Review your historical data</p>
          </div>
        )}
        <div className="flex items-center gap-2 sm:gap-4">
          {showImportExport && onImportSuccess && <SessionHistoryToolbar onImportSuccess={onImportSuccess} />}
          <span className="type-meta flex-shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1 text-subtle/70">
            {sessions.length} session(s)
          </span>
        </div>
      </div>
      <div className="divide-y divide-[var(--color-border)]/50">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-[15px] text-muted">No sessions logged for this range yet.</div>
        ) : (
          sessions.map((session) => {
            const totals = getSessionTotals(session)
            const isExpanded = Boolean(expandedSessions[session.id])
            return (
              <div key={session.id} className="group space-y-4 p-4 transition-all hover:bg-[var(--color-surface-subtle)]/40 sm:p-5">
                <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(16rem,1.2fr)_minmax(0,1.7fr)_auto] lg:items-center lg:gap-4">
                  <div className="space-y-1.5 lg:min-w-[16rem]">
                    <p className="text-[17px] font-semibold leading-snug text-strong transition-colors group-hover:text-[var(--color-primary)]">{formatSessionDisplayTitle(getSessionTitle(session), session.started_at, session.ended_at)}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-subtle">
                      <span className="text-strong opacity-80">{formatDateTime(session.started_at)}</span>
                      {session.body_weight_lb && (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-border-strong)] opacity-30" />
                          <span>{isKg ? Math.round(session.body_weight_lb * KG_PER_LB * 10) / 10 : session.body_weight_lb} {displayUnit} BW</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-2">
                    <span className={`${metricBadgeBaseClass} border border-[var(--color-border)] bg-[var(--color-bg)] text-subtle/80`}>{totals.exercises} exercises</span>
                    <span className={`${metricBadgeBaseClass} border border-[var(--color-border)] bg-[var(--color-bg)] text-subtle/80`}>{totals.sets} sets</span>
                    <span className={`${metricBadgeBaseClass} border border-[var(--color-border)] bg-[var(--color-bg)] text-subtle/80`}>{Math.round(isKg ? totals.volume * KG_PER_LB : totals.volume).toLocaleString()} {displayUnit} vol</span>
                    <span className={`${metricBadgeBaseClass} border border-[var(--color-primary-border)]/30 bg-[var(--color-primary-soft)]/30 text-[var(--color-primary-strong)]`}>{Math.round(totals.workload).toLocaleString()} load</span>
                    <span className={`${metricBadgeBaseClass} border border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success-strong)]`}>{totals.hardSets} hard sets</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    {showActions && (
                      <Link href={`/sessions/${session.id}/edit`}>
                        <Button variant="outline" className="h-10 px-4 text-[13px] font-semibold">Edit</Button>
                      </Link>
                    )}
                    <Button
                      type="button"
                      onClick={() => handleToggleSession(session.id)}
                      className="h-10 px-4 text-[13px] font-semibold"
                      variant="secondary"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </Button>
                    {showActions && (
                      <Button
                        type="button"
                        onClick={() => setSessionToDelete(session)}
                        className="h-10 w-10 p-0 border-2 border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                        variant="outline"
                        disabled={Boolean(deletingSessionIds[session.id])}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="space-y-4 border-t border-[var(--color-border)]/30 pt-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid gap-4 md:grid-cols-2">
                      {session.session_exercises.map((exercise) => {
                        // Calculate exercise totals using canonical functions
                        let exerciseTonnage = 0
                        let exerciseLoad = 0
                        const completedSets = (exercise.sets ?? []).filter(s => s.completed !== false)
                        const sortedSets = [...completedSets].sort((a, b) => {
                          const aNum = typeof a.set_number === 'number' ? a.set_number : Number.MAX_SAFE_INTEGER
                          const bNum = typeof b.set_number === 'number' ? b.set_number : Number.MAX_SAFE_INTEGER
                          if (aNum !== bNum) return aNum - bNum
                          const aTime = a.performed_at ? new Date(a.performed_at).getTime() : Number.MAX_SAFE_INTEGER
                          const bTime = b.performed_at ? new Date(b.performed_at).getTime() : Number.MAX_SAFE_INTEGER
                          return aTime - bTime
                        })
                        
                        const setMetrics = sortedSets.map((set) => {
                          const setData = {
                            metricProfile: exercise.metric_profile ?? undefined,
                            reps: set.reps ?? null,
                            weight: set.weight ?? null,
                            implementCount: set.implement_count ?? null,
                            loadType: (set.load_type as 'total' | 'per_implement' | null) ?? null,
                            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
                            rpe: typeof set.rpe === 'number' ? set.rpe : null,
                            rir: typeof set.rir === 'number' ? set.rir : null,
                            durationSeconds: set.duration_seconds ?? null
                          }
                          const tonnage = computeSetTonnage(setData)
                          const load = computeSetLoad(setData)
                          exerciseTonnage += tonnage
                          exerciseLoad += load
                          return { set, tonnage, load }
                        })
                        
                        const displayTonnage = Math.round(isKg ? exerciseTonnage * KG_PER_LB : exerciseTonnage)
                        const displayLoad = Math.round(exerciseLoad)
                        
                        return (
                        <div key={exercise.id} className="surface-card-muted rounded-2xl border border-[var(--color-border)] p-4 transition-all hover:bg-[var(--color-surface-muted)]/50">
                          <p className="mb-2 text-[15px] font-semibold text-strong">{exercise.exercise_name}</p>
                          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-medium text-subtle/80">
                            <p>Primary: <span className="text-strong">{exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'N/A'}</span></p>
                            {exercise.secondary_muscles && exercise.secondary_muscles.length > 0 && (
                              <p>Secondary: <span className="text-strong">{exercise.secondary_muscles.map((muscle: string) => toMuscleLabel(muscle)).join(', ')}</span></p>
                            )}
                          </div>
                          {/* Exercise Totals */}
                          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[var(--color-border)]/30 pb-3">
                            <span className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle/80">
                              {displayTonnage.toLocaleString()} {displayUnit} vol
                            </span>
                            <span className="inline-flex items-center rounded-md border border-[var(--color-primary-border)]/30 bg-[var(--color-primary-soft)]/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-primary-strong)]">
                              {displayLoad.toLocaleString()} load
                            </span>
                            <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.06em] text-subtle/60">
                              {completedSets.length} set{completedSets.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {/* Per-Set Breakdown */}
                          <div className="space-y-1.5">
                            {setMetrics.map(({ set, tonnage, load }) => {
                              const totalLabel = formatTotalWeightLabel({
                                weight: set.weight ?? null,
                                weightUnit: (set.weight_unit as WeightUnit) || 'lb',
                                displayUnit,
                                loadType: (set.load_type as 'total' | 'per_implement' | null) ?? null,
                                implementCount: set.implement_count ?? null
                              });
                              
                              const setTonnageDisplay = Math.round(isKg ? tonnage * KG_PER_LB : tonnage)
                              const setLoadDisplay = Math.round(load)
                              const hasDuration = typeof set.duration_seconds === 'number' && set.duration_seconds > 0
                              
                              return (
                                <div key={set.id} className="rounded-lg border border-[var(--color-border)]/40 bg-[var(--color-surface-subtle)]/30 px-2.5 py-2 transition-colors hover:border-[var(--color-border)]">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    {/* Set number */}
                                    <span className="w-12 shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle/60">Set {set.set_number ?? '?'}</span>
                                    
                                    {/* Inputs: weight × reps or duration */}
                                    <div className="min-w-0 flex-1 text-[14px] font-semibold text-strong">
                                      {totalLabel ? (
                                        <>
                                          {totalLabel} <span className="text-subtle/40 mx-0.5">×</span> {set.reps ?? 0}
                                        </>
                                      ) : hasDuration ? (
                                        <span className="text-subtle">{Math.round(set.duration_seconds! / 60)}min</span>
                                      ) : (
                                        <span className="text-subtle/50 italic">No load data</span>
                                      )}
                                      {/* RPE/RIR inline */}
                                      {(typeof set.rpe === 'number' || typeof set.rir === 'number') && (
                                        <span className="ml-1.5 text-[12px] font-medium text-subtle/60">
                                          {typeof set.rpe === 'number' ? `@${set.rpe}` : ''}
                                          {typeof set.rir === 'number' ? `RIR${set.rir}` : ''}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Per-set computed values */}
                                    <div className="flex items-center gap-2 shrink-0">
                                      {setTonnageDisplay > 0 && (
                                        <span className="text-[12px] font-medium text-subtle/70 tabular-nums">
                                          {setTonnageDisplay.toLocaleString()} {displayUnit}
                                        </span>
                                      )}
                                      {setLoadDisplay > 0 && (
                                        <span className="text-[12px] font-semibold text-[var(--color-primary)] tabular-nums">
                                          {setLoadDisplay.toLocaleString()} ld
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      {hasMore && (
        <div className="border-t border-[var(--color-border)] px-4 py-5 text-center sm:px-5">
          <Button
            variant="secondary"
            onClick={onLoadMore}
            disabled={loading}
            className="h-11 px-8 text-[13px] font-semibold shadow-sm transition-all active:scale-95"
          >
            {loading ? 'Loading...' : 'Load more sessions'}
          </Button>
        </div>
      )}
    </>
  )

  return (
    <>
      {embedded ? (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {listContent}
        </div>
      ) : (
        <Card className="glass-panel">
          {listContent}
        </Card>
      )}
      {showActions && (
        <ConfirmDialog
          isOpen={Boolean(sessionToDelete)}
          onClose={() => setSessionToDelete(null)}
          onConfirm={executeDeleteSession}
          title="Delete Session"
          description="Are you sure you want to delete this session? This will remove all associated sets and metrics. This cannot be undone."
          confirmText="Delete Session"
          variant="danger"
          isLoading={sessionToDelete ? Boolean(deletingSessionIds[sessionToDelete.id]) : false}
        />
      )}
    </>
  )
}
