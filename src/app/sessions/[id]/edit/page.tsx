'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { ActiveSession } from '@/components/workout/ActiveSession'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ValidationBlockerModal } from '@/components/ui/ValidationBlockerModal'
import { useSupabase } from '@/hooks/useSupabase'
import { completeSession } from '@/lib/session-completion'
import { validateSessionForCompletion, type SetValidationError } from '@/lib/session-validation'
import { parseWithFallback, sessionQueryResultSchema } from '@/lib/validation/schemas'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import type { SessionGoal, WorkoutSession, MetricProfile, LoadType, WeightUnit, SessionExercise, WorkoutSet } from '@/types/domain'

type ConfirmAction = {
  type: 'save' | 'cancel'
  title: string
  description: string
  confirmText: string
  variant: 'danger' | 'info' | 'warning'
}

type SessionPayload = {
  id: string
  user_id: string | null
  name: string
  template_id: string | null
  session_focus?: string | null
  session_goal?: string | null
  session_intensity?: string | null
  started_at: string
  ended_at: string | null
  status: string | null
  body_weight_lb?: number | null
  session_notes?: string | null
  weight_unit?: string | null
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    metric_profile: string | null
    order_index: number | null
    sets: Array<{
      id: string
      set_number: number | null
      reps: number | null
      weight: number | null
      implement_count: number | null
      load_type: string | null
      rpe: number | null
      rir: number | null
      completed: boolean | null
      performed_at: string | null
      weight_unit: string | null
      duration_seconds: number | null
      distance: number | null
      distance_unit: string | null
      rest_seconds_actual: number | null
      extras: Record<string, unknown> | null
      extra_metrics: Record<string, unknown> | null
    }>
  }>
}

function mapPayloadToSession(payload: SessionPayload): WorkoutSession {
  return {
    id: payload.id,
    userId: payload.user_id ?? '',
    templateId: payload.template_id ?? undefined,
    name: payload.name,
    sessionFocus: (payload.session_focus as WorkoutSession['sessionFocus']) ?? null,
    sessionGoal: (payload.session_goal as WorkoutSession['sessionGoal']) ?? null,
    sessionIntensity: (payload.session_intensity as WorkoutSession['sessionIntensity']) ?? null,
    startedAt: payload.started_at,
    endedAt: payload.ended_at ?? undefined,
    status: 'in_progress', // Allow editing
    sessionNotes: payload.session_notes ?? undefined,
    bodyWeightLb: payload.body_weight_lb ?? null,
    weightUnit: (payload.weight_unit as WeightUnit) ?? 'lb',
    exercises: (() => {
      // First, map all raw exercises
      const rawExercises = payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, idx) => ({
          id: exercise.id,
          sessionId: payload.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
          secondaryMuscles: (exercise.secondary_muscles ?? []).map((muscle) => toMuscleLabel(muscle)),
          metricProfile: (exercise.metric_profile as MetricProfile) ?? undefined,
          orderIndex: exercise.order_index ?? idx,
                      sets: (exercise.sets ?? [])
                      .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
                      .map((set, setIdx) => ({
                        id: set.id,
                        setNumber: set.set_number ?? setIdx + 1,
                        reps: set.reps ?? '',
                        weight: set.weight ?? '',
                        implementCount: set.implement_count ?? '',
                        loadType: (set.load_type as LoadType | null) ?? '',
                        rpe: set.rpe ?? '',
                        rir: set.rir ?? '',
                        performedAt: set.performed_at ?? undefined,
                        completed: set.completed ?? false,
                        weightUnit: (set.weight_unit as WeightUnit) ?? 'lb',
                        durationSeconds: set.duration_seconds ?? undefined,
                        distance: set.distance ?? undefined,
                        distanceUnit: set.distance_unit ?? undefined,
                        restSecondsActual: set.rest_seconds_actual ?? undefined,
                        extras: set.extras as Record<string, string | null> ?? undefined,
                        extraMetrics: set.extra_metrics ?? undefined
                      })) as WorkoutSet[]
                  })) as SessionExercise[]
      // Deduplicate exercises by name
      const exerciseMap = new Map<string, typeof rawExercises[0]>()
      
      for (const ex of rawExercises) {
        const key = ex.name.toLowerCase()
        if (exerciseMap.has(key)) {
          // Merge sets
          const existing = exerciseMap.get(key)!
          
          // Deduplicate sets by ID
          const setMap = new Map(existing.sets.map(s => [s.id, s]))
          ex.sets.forEach(s => setMap.set(s.id, s))
          const combinedSets = Array.from(setMap.values())
          
          // Sort merged sets by set number (or id if set number missing)
          combinedSets.sort((a, b) => a.setNumber - b.setNumber)
          // Renumber
          combinedSets.forEach((s, i) => s.setNumber = i + 1)
          existing.sets = combinedSets
        } else {
          exerciseMap.set(key, ex)
        }
      }

      return Array.from(exerciseMap.values())
        .sort((a, b) => a.orderIndex - b.orderIndex)
    })()
  }
}

function SessionEditContent() {
  const params = useParams()
  const router = useRouter()
  const supabase = useSupabase()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const startSession = useWorkoutStore((state) => state.startSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const { catalog } = useExerciseCatalog()
  
  const sessionId = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingSession, setSavingSession] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [validationErrors, setValidationErrors] = useState<SetValidationError[]>([])
  const [showValidationBlocker, setShowValidationBlocker] = useState(false)
  const [hasNoCompletedSets, setHasNoCompletedSets] = useState(false)
  
  // Track original session data for duration calculation
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [startTimeOverride, setStartTimeOverride] = useState<string | null>(null)
  
  // Parse session notes for equipment inventory
  const sessionNotes = useMemo(() => {
    if (!activeSession?.sessionNotes) return null
    try {
      return typeof activeSession.sessionNotes === 'string' 
        ? JSON.parse(activeSession.sessionNotes) 
        : activeSession.sessionNotes
    } catch {
      return null
    }
  }, [activeSession?.sessionNotes])
  
  const sessionGoal = (activeSession?.sessionGoal ?? sessionNotes?.goal ?? null) as SessionGoal | null
  const sessionFocus = activeSession?.sessionFocus ?? sessionNotes?.focus ?? null
  const equipmentInventory = sessionNotes?.equipmentInventory ?? null
  const sessionTitle = activeSession?.name ?? 'Edit Session'
  
  // Load existing session into store
  const loadSession = useCallback(async () => {
    if (!sessionId) return
    
    setLoading(true)
    setLoadError(null)
    
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, user_id, name, template_id, session_focus, session_goal, session_intensity, 
          started_at, ended_at, status, body_weight_lb, session_notes,
          session_exercises(
            id, exercise_name, primary_muscle, secondary_muscles, 
            metric_profile, order_index, 
            sets(
              id, set_number, reps, weight, implement_count, load_type, 
              rpe, rir, completed, performed_at, weight_unit, 
              duration_seconds, distance, distance_unit, rest_seconds_actual, 
              extras, extra_metrics
            )
          )
        `)
        .eq('id', sessionId)
        .single()
      
      if (error) throw error
      if (!data) throw new Error('Session not found')
      
      const payload = parseWithFallback(sessionQueryResultSchema, data, 'session edit') as SessionPayload
      const session = mapPayloadToSession(payload)
      
      // Calculate original duration
      if (payload.started_at && payload.ended_at) {
        const start = new Date(payload.started_at).getTime()
        const end = new Date(payload.ended_at).getTime()
        const mins = Math.round((end - start) / 60000)
        setDurationMinutes(mins > 0 ? mins : 45)
      }
      
      startSession(session)
    } catch (err) {
      const errorDetails = err && typeof err === 'object' 
        ? JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
        : String(err)
      console.error('Failed to load session:', errorDetails)
      setLoadError('Unable to load session for editing.')
    } finally {
      setLoading(false)
    }
  }, [sessionId, supabase, startSession])
  
  // Load session on mount (only if not already in store with matching ID)
  useEffect(() => {
    if (activeSession?.id === sessionId) {
      setLoading(false)
      return
    }
    loadSession()
  }, [sessionId, activeSession?.id, loadSession])
  
  const requestSave = () => {
    // Validate session before showing save confirmation
    const validation = validateSessionForCompletion(activeSession)
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      setHasNoCompletedSets(validation.hasNoCompletedSets)
      setShowValidationBlocker(true)
      return
    }
    
    setConfirmAction({
      type: 'save',
      title: 'Save Changes',
      description: 'Save your edits to this workout? All metrics will be recalculated.',
      confirmText: 'Save',
      variant: 'info'
    })
  }
  
  const requestCancel = () => {
    setConfirmAction({
      type: 'cancel',
      title: 'Discard Changes',
      description: 'Are you sure you want to discard your changes? The original session will be preserved.',
      confirmText: 'Discard',
      variant: 'danger'
    })
  }
  
  const handleConfirmAction = async () => {
    if (!confirmAction) return
    if (confirmAction.type === 'save') await executeSave()
    if (confirmAction.type === 'cancel') executeCancel()
    setConfirmAction(null)
  }
  
  const executeSave = async () => {
    if (!sessionId || !activeSession || !user?.id) return
    setSaveError(null)
    setSavingSession(true)
    
    try {
      // Calculate end time based on start time + duration
      const baseStartTime = startTimeOverride 
        ? new Date(startTimeOverride).getTime()
        : new Date(activeSession.startedAt).getTime()
      const endedAt = new Date(baseStartTime + durationMinutes * 60 * 1000).toISOString()
      const startedAtFinal = startTimeOverride ?? activeSession.startedAt
      
      // Create a modified session with the end time for the snapshot
      const sessionWithEnd = {
        ...activeSession,
        startedAt: startedAtFinal,
        endedAt
      }
      
      // Use completeSession to update the session with recalculated metrics
      const result = await completeSession({
        supabase,
        sessionId,
        session: sessionWithEnd,
        userId: user.id,
        bodyWeightLb: activeSession.bodyWeightLb ?? null,
        sessionGoal,
        equipmentInventory,
        exerciseCatalog: catalog.map((e) => ({ name: e.name, e1rmEligible: e.e1rmEligible })),
        endedAtOverride: endedAt,
        startedAtOverride: startedAtFinal
      })
      
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to save changes')
      }
      
      endSession()
      router.push('/progress')
    } catch (error) {
      console.error('Failed to save session:', error)
      setSaveError('Failed to save changes. Please try again.')
    } finally {
      setSavingSession(false)
    }
  }
  
  const executeCancel = () => {
    endSession()
    router.push('/progress')
  }
  
  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to edit sessions.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }
  
  if (loading) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        Loading session...
      </div>
    )
  }
  
  if (loadError || !activeSession) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">{loadError ?? 'Session not found.'}</p>
        <Button onClick={() => router.push('/progress')}>Return to Progress</Button>
      </div>
    )
  }
  
  return (
    <div className="page-shell">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href="/progress" className="transition-colors hover:text-strong">
                Progress
              </Link>
              <span>/</span>
              <span className="text-subtle">Edit Session</span>
            </div>
            <h1 className="font-display text-2xl font-semibold text-strong">{sessionTitle}</h1>
            <p className="text-sm text-muted">
              Edit exercises and sets for this workout.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={requestCancel}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_1fr)_320px]">
          <div>
            <ActiveSession
              sessionId={sessionId}
              equipmentInventory={equipmentInventory}
              onFinish={requestSave}
              onCancel={requestCancel}
              isFinishing={savingSession}
              focus={activeSession?.sessionFocusAreas ?? sessionFocus}
              style={sessionGoal}
              onStartTimeChange={setStartTimeOverride}
            />
          </div>
          
          <div className="space-y-4">
            {/* Save Controls */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Save className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-strong">Save Changes</h2>
              </div>
              
              {saveError && (
                <div className="mb-4 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)]/10 p-3 text-xs text-[var(--color-danger)]">
                  {saveError}
                </div>
              )}
              
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestSave}
                  disabled={savingSession}
                  className="w-full justify-center"
                >
                  {savingSession ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={requestCancel}
                  className="w-full justify-center text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                >
                  Cancel Edit
                </Button>
              </div>
            </Card>
            
            {/* Tips */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong">Tips</h2>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                <li>• Click &quot;Add Exercise&quot; to add new exercises</li>
                <li>• Edit reps, weight, and RPE for any set</li>
                <li>• Swap or remove exercises as needed</li>
                <li>• All metrics will recalculate on save</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
      
      <ConfirmDialog 
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.description ?? ''}
        confirmText={confirmAction?.confirmText}
        variant={confirmAction?.variant}
        isLoading={savingSession}
      />
      
      <ValidationBlockerModal
        isOpen={showValidationBlocker}
        onClose={() => setShowValidationBlocker(false)}
        errors={validationErrors}
        hasNoCompletedSets={hasNoCompletedSets}
      />
    </div>
  )
}

export default function SessionEditPage() {
  return (
    <Suspense fallback={<div className="page-shell p-10 text-center text-muted">Loading...</div>}>
      <SessionEditContent />
    </Suspense>
  )
}
