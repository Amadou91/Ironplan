'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Activity, Clock, Flame, Trophy, Gauge, Shuffle, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Exercise, PlanDay, PlanInput, WorkoutImpact } from '@/types/domain'
import { enhanceExerciseData, toMuscleLabel, toMuscleSlug } from '@/lib/muscle-utils'
import { formatSessionName } from '@/lib/workout-metrics'
import { calculateExerciseImpact } from '@/lib/generator'
import { createWorkoutSession } from '@/lib/session-creation'
import ActiveSession from '@/components/workout/ActiveSession'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { getSwapSuggestions } from '@/lib/exercise-swap'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import { computeExerciseMetrics } from '@/lib/workout-metrics'

type Workout = {
  id: string
  title: string
  description: string
  goal: string
  level: string
  exercises:
    | {
        schedule?: Array<{ dayOfWeek: number; timeWindow: string; exercises?: Exercise[] }>
        summary?: { totalMinutes?: number; impact?: WorkoutImpact }
        inputs?: PlanInput
      }
    | Exercise[]
    | null
  created_at: string
}

export default function WorkoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingSession, setStartingSession] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishingSession, setFinishingSession] = useState(false)
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>([])
  const [swapOptions, setSwapOptions] = useState<{
    index: number
    suggestions: Exercise[]
    usedFallback: boolean
  } | null>(null)
  const [lastSwap, setLastSwap] = useState<{ index: number; previous: Exercise } | null>(null)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [swapNotice, setSwapNotice] = useState<string | null>(null)
  const [savingSwap, setSavingSwap] = useState(false)
  const startSession = useWorkoutStore((state) => state.startSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const replaceSessionExercise = useWorkoutStore((state) => state.replaceSessionExercise)
  const activeSession = useWorkoutStore((state) => state.activeSession)

  useEffect(() => {
    const fetchWorkout = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) {
        console.error('Error fetching workout:', error)
      } else {
        setWorkout(data)
      }
      setLoading(false)
    }

    if (params.id) fetchWorkout()
  }, [params.id, supabase])

  const schedule = useMemo<PlanDay[]>(
    () => (!workout?.exercises || Array.isArray(workout.exercises) ? [] : workout.exercises.schedule ?? []),
    [workout]
  )

  const selectedSchedule = useMemo(() => {
    if (!schedule.length) return null
    const sessionIndexParam = Number.parseInt(searchParams.get('sessionIndex') ?? '', 10)
    const resolvedIndex = Number.isFinite(sessionIndexParam) && sessionIndexParam >= 0 && sessionIndexParam < schedule.length
      ? sessionIndexParam
      : 0
    return schedule[resolvedIndex] ?? schedule[0]
  }, [schedule, searchParams])

  const exercises = useMemo(() => {
    if (!workout?.exercises) return []
    if (Array.isArray(workout.exercises)) return workout.exercises
    return selectedSchedule?.exercises ?? []
  }, [selectedSchedule, workout])

  useEffect(() => {
    setSessionExercises(exercises)
    setSwapOptions(null)
    setSwapNotice(null)
    setSwapError(null)
    setLastSwap(null)
  }, [exercises, selectedSchedule])

  const summary = useMemo(
    () => (!workout?.exercises || Array.isArray(workout.exercises) ? undefined : workout.exercises.summary),
    [workout]
  )

  const inputs = useMemo(
    () => (!workout?.exercises || Array.isArray(workout.exercises) ? undefined : workout.exercises.inputs),
    [workout]
  )
  const impact = useMemo(() => {
    if (!sessionExercises.length) return undefined
    return calculateExerciseImpact(sessionExercises)
  }, [sessionExercises])
  const planImpact = summary?.impact
  const sessionActive = searchParams.get('session') === 'active'
  const sessionId = searchParams.get('sessionId')
  const hasActiveSession = Boolean(activeSession)
  const isCurrentSessionActive = sessionActive || (activeSession?.workoutId === workout?.id)
  const activeSessionLink = activeSession?.workoutId
    ? `/workout/${activeSession.workoutId}?session=active&sessionId=${activeSession.id}`
    : '/dashboard'
  const enrichedExercises = useMemo(
    () =>
      sessionExercises.map((exercise) =>
        enhanceExerciseData({
          ...exercise,
          primaryMuscle: exercise.primaryBodyParts?.[0] ?? exercise.primaryMuscle ?? exercise.focus ?? ''
        })
      ),
    [sessionExercises]
  )

  const inventory = inputs?.equipment?.inventory

  const updateActiveSessionSwap = async (replacement: Exercise, index: number) => {
    if (!activeSession || activeSession.workoutId !== workout?.id) return
    const sessionExercise = activeSession.exercises[index]
    if (!sessionExercise?.id) return

    const primaryMuscle = replacement.primaryBodyParts?.[0] ?? replacement.primaryMuscle ?? replacement.focus ?? 'Full Body'
    const secondaryMuscles = replacement.secondaryBodyParts ?? replacement.secondaryMuscles ?? []
    const primarySlug = toMuscleSlug(primaryMuscle, 'full_body') ?? 'full_body'
    const secondarySlugs = secondaryMuscles
      .map((muscle) => toMuscleSlug(muscle, null))
      .filter((muscle): muscle is string => Boolean(muscle))

    const { error: exerciseError } = await supabase
      .from('session_exercises')
      .update({
        exercise_name: replacement.name,
        primary_muscle: primarySlug,
        secondary_muscles: secondarySlugs
      })
      .eq('id', sessionExercise.id)

    if (exerciseError) {
      throw exerciseError
    }

    const { error: setDeleteError } = await supabase
      .from('sets')
      .delete()
      .eq('session_exercise_id', sessionExercise.id)

    if (setDeleteError) {
      throw setDeleteError
    }

    replaceSessionExercise(index, {
      name: replacement.name,
      primaryMuscle: toMuscleLabel(primarySlug),
      secondaryMuscles: secondarySlugs.map((muscle) => toMuscleLabel(muscle)),
      sets: []
    })
  }

  const persistSwap = async (updatedExercises: Exercise[]) => {
    if (!workout || !selectedSchedule || !workout.exercises || Array.isArray(workout.exercises)) return
    setSavingSwap(true)
    setSwapError(null)
    try {
      const updatedSchedule = (workout.exercises.schedule ?? []).map((day) =>
        day.dayOfWeek === selectedSchedule.dayOfWeek ? { ...day, exercises: updatedExercises } : day
      )
      const updatedExercisesPayload = { ...workout.exercises, schedule: updatedSchedule }

      const { error: updateError } = await supabase
        .from('workouts')
        .update({ exercises: updatedExercisesPayload })
        .eq('id', workout.id)

      if (updateError) {
        throw updateError
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const sessionName = formatSessionName(selectedSchedule, workout.goal)
        const sessionPayload = {
          user_id: user.id,
          workout_id: workout.id,
          day_of_week: selectedSchedule.dayOfWeek,
          session_name: sessionName,
          workouts: updatedExercises,
          updated_at: new Date().toISOString()
        }

        const { data: existingSession, error: lookupError } = await supabase
          .from('saved_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('workout_id', workout.id)
          .eq('day_of_week', selectedSchedule.dayOfWeek)
          .maybeSingle()

        if (lookupError) {
          console.error('Failed to lookup saved session', lookupError)
        }

        if (existingSession?.id) {
          const { error: savedSessionError } = await supabase
            .from('saved_sessions')
            .update(sessionPayload)
            .eq('id', existingSession.id)

          if (savedSessionError) {
            console.error('Failed to update saved session', savedSessionError)
          }
        } else {
          const { error: savedSessionError } = await supabase
            .from('saved_sessions')
            .insert(sessionPayload)

          if (savedSessionError) {
            console.error('Failed to create saved session', savedSessionError)
          }
        }
      }

      setWorkout((prev) => (prev ? { ...prev, exercises: updatedExercisesPayload } : prev))
    } catch (error) {
      console.error('Failed to persist swap', error)
      setSwapError('Unable to save the swap. Please try again.')
    } finally {
      setSavingSwap(false)
    }
  }

  const handleSwapRequest = (exercise: Exercise, index: number) => {
    setSwapError(null)
    if (!inventory) {
      setSwapError('Equipment inventory is missing. Update your plan preferences before swapping.')
      return
    }
    const { suggestions, usedFallback } = getSwapSuggestions({
      current: exercise,
      sessionExercises,
      inventory,
      library: EXERCISE_LIBRARY
    })
    setSwapOptions({
      index,
      suggestions: suggestions.map((item) => item.exercise),
      usedFallback
    })
    setSwapNotice(
      usedFallback ? 'Closest match found based on equipment and muscle group.' : null
    )
    if (suggestions.length === 0) {
      setSwapError('No suitable swaps were found for this exercise.')
    }
  }

  const handleSwapSelect = async (replacement: Exercise) => {
    if (!swapOptions) return
    const previous = sessionExercises[swapOptions.index]
    if (!previous) return
    if (isCurrentSessionActive && activeSession?.exercises?.[swapOptions.index]?.sets?.length) {
      const confirmed = confirm('This exercise already has logged sets. Swapping will clear those sets in the active session. Continue?')
      if (!confirmed) return
    }

    const updated = sessionExercises.map((exercise, idx) =>
      idx === swapOptions.index
        ? {
            ...replacement,
            load: replacement.load ?? exercise.load,
            sets: replacement.sets ?? exercise.sets,
            reps: replacement.reps ?? exercise.reps,
            rpe: replacement.rpe ?? exercise.rpe,
            durationMinutes: replacement.durationMinutes ?? exercise.durationMinutes,
            restSeconds: replacement.restSeconds ?? exercise.restSeconds
          }
        : exercise
    )

    setSessionExercises(updated)
    setSwapOptions(null)
    setSwapNotice(null)
    setLastSwap({ index: swapOptions.index, previous })
    try {
      await persistSwap(updated)
      await updateActiveSessionSwap(replacement, swapOptions.index)
    } catch (error) {
      console.error('Failed to apply swap', error)
      setSwapError('Swap saved to the plan, but the active session did not update. Refresh or restart the session.')
    }
  }

  const handleUndoSwap = async () => {
    if (!lastSwap) return
    const updated = sessionExercises.map((exercise, idx) =>
      idx === lastSwap.index ? lastSwap.previous : exercise
    )
    setSessionExercises(updated)
    setLastSwap(null)
    await persistSwap(updated)
  }

  if (loading) return <div className="page-shell p-10 text-center text-muted">Loading workout...</div>
  if (!workout) return <div className="page-shell p-10 text-center text-muted">Workout not found.</div>

  // Per-workout metrics are computed from each exercise's sets/reps/RPE data.
  // Assumptions: reps ranges are averaged, RPE is on a 1–10 scale, and density uses a
  // default 2 minutes per set when duration/rest data is missing.
  // Missing data is handled by returning null and rendering a "—" placeholder.

  const handleStartSession = async () => {
    setStartError(null)
    setFinishError(null)
    if (hasActiveSession) {
      setStartError('Finish your current session before starting a new one.')
      return
    }
    setStartingSession(true)
    try {
      if (!workout?.id) throw new Error('Missing workout id.')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const nameSuffix = selectedSchedule ? formatSessionName(selectedSchedule, workout.goal) : undefined
      const { sessionId, startedAt, sessionName, exercises: createdExercises, impact: sessionImpact } = await createWorkoutSession({
        supabase,
        userId: user.id,
        workoutId: workout.id,
        workoutTitle: workout.title,
        exercises: sessionExercises,
        nameSuffix,
        impact
      })

      startSession({
        id: sessionId,
        userId: user.id,
        workoutId: workout.id,
        name: sessionName,
        startedAt,
        status: 'active',
        impact: sessionImpact,
        exercises: createdExercises
      })

      const scheduleIndex = selectedSchedule ? schedule.indexOf(selectedSchedule) : -1
      const indexParam = scheduleIndex >= 0 ? `&sessionIndex=${scheduleIndex}` : ''
      router.push(`/workout/${workout.id}?session=active&sessionId=${sessionId}${indexParam}`)
    } catch (error) {
      console.error('Failed to start session', error)
      setStartError('Unable to start the session. Please try again.')
    } finally {
      setStartingSession(false)
    }
  }

  const handleFinishSession = async () => {
    if (!activeSession) return
    if (!confirm('Are you sure you want to finish this workout?')) return
    setFinishError(null)
    setFinishingSession(true)
    try {
      const sessionUpdate = {
        ended_at: new Date().toISOString(),
        status: 'completed',
        ...(activeSession.impact ? { impact: activeSession.impact } : {})
      }
      const { error } = await supabase
        .from('sessions')
        .update(sessionUpdate)
        .eq('id', activeSession.id)

      if (error) throw error
      endSession()
      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to finish workout:', error)
      setFinishError('Failed to finish workout. Please try again.')
    } finally {
      setFinishingSession(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-10 2xl:px-16">
      <button onClick={() => router.back()} className="mb-6 flex items-center text-sm text-muted transition-colors hover:text-strong">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Dashboard
      </button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {sessionActive && (activeSession || sessionId) && <ActiveSession sessionId={sessionId} />}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-semibold text-strong">{workout.title}</h1>
              <p className="text-muted">{workout.description}</p>
              {selectedSchedule && (
                <p className="mt-2 text-sm text-subtle">
                  {formatSessionName(selectedSchedule, workout.goal)} · {selectedSchedule.timeWindow.replace('_', ' ')}
                </p>
              )}
            </div>
            <span className="badge-accent">
              {workout.goal}
            </span>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center text-lg font-semibold text-strong">
              <Activity className="mr-2 h-5 w-5 text-accent" />
              Regimen
            </h3>
            {swapError && (
              <div className="alert-error px-3 py-2 text-xs">
                {swapError}
              </div>
            )}
            {isCurrentSessionActive && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-muted">
                Swaps made here will update your active session and reset any logged sets for the swapped exercise.
              </div>
            )}
            {lastSwap && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-3 py-2 text-xs text-[var(--color-primary-strong)]">
                <span>Swap applied. Not the right fit?</span>
                <Button type="button" variant="secondary" size="sm" onClick={handleUndoSwap} disabled={savingSwap}>
                  <Undo2 className="h-4 w-4" /> Undo
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {enrichedExercises.map((ex, idx) => {
                const metrics = computeExerciseMetrics(ex)
                const primaryParts = ex.primaryMuscle ? toMuscleLabel(ex.primaryMuscle) : '—'
                const secondaryParts = ex.secondaryMuscles?.length ? ex.secondaryMuscles.map((muscle) => toMuscleLabel(muscle)).join(', ') : '—'

                return (
                  <div key={idx} className="surface-card-muted p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-semibold text-[var(--color-primary-strong)]">
                          {idx + 1}
                        </div>
                        <div className="space-y-2">
                          <div>
                            <h4 className="font-medium text-strong">{ex.name}</h4>
                            <p className="text-xs text-subtle">{ex.load?.label ?? 'Target: General'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted">
                            <span className="badge-neutral">
                              Primary: {primaryParts ?? '—'}
                            </span>
                            <span className="badge-neutral">
                              Secondary: {secondaryParts ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <div className="flex flex-wrap gap-3 text-xs font-mono text-muted">
                          <span>{ex.sets} sets</span>
                          <span>{ex.reps} reps</span>
                          <span>Vol {metrics.volume ?? '—'}</span>
                          <span>Int {metrics.intensity ?? '—'}</span>
                          <span>Den {metrics.density ?? '—'}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSwapRequest(ex, idx)}
                          disabled={savingSwap}
                        >
                          <Shuffle className="h-4 w-4" /> Swap
                        </Button>
                      </div>
                    </div>
                    {swapOptions?.index === idx && (
                      <div className="mt-3 space-y-2">
                        {swapNotice && (
                          <p className="text-xs text-subtle">{swapNotice}</p>
                        )}
                        {swapOptions.suggestions.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {swapOptions.suggestions.map((suggestion) => (
                              <button
                                key={suggestion.name}
                                type="button"
                                onClick={() => handleSwapSelect(suggestion)}
                                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-muted transition hover:border-[var(--color-border-strong)] hover:text-strong"
                              >
                                {suggestion.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-subtle">No alternatives found for this exercise.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
           <Card className="p-6">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Program Stats</h3>
              <div className="space-y-4 text-sm text-muted">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                   <div className="flex items-center">
                     <Clock className="mr-2 h-4 w-4 text-subtle" /> Duration
                   </div>
                   <span className="font-medium text-strong">{selectedSchedule?.durationMinutes ?? summary?.totalMinutes ?? '~60'} min</span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                   <div className="flex items-center">
                     <Flame className="mr-2 h-4 w-4 text-subtle" /> Intensity
                   </div>
                   <span className="font-medium text-strong capitalize">{inputs?.intensity ?? 'Moderate'}</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center">
                     <Trophy className="mr-2 h-4 w-4 text-subtle" /> Level
                   </div>
                   <span className="font-medium text-strong capitalize">{workout.level}</span>
                </div>
              </div>
              {isCurrentSessionActive && (
                <div className="mt-4 rounded-md border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-3 py-2 text-xs font-medium text-[var(--color-primary-strong)]">
                  Session active. Log your sets below to track progress.
                </div>
              )}
              {hasActiveSession && !isCurrentSessionActive && (
                <div className="mt-4 rounded-md border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-3 py-2 text-xs font-medium text-[var(--color-primary-strong)]">
                  You already have a session in progress. Return to it before starting a new one.
                  <div className="mt-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => router.push(activeSessionLink)}>
                      Resume active session
                    </Button>
                  </div>
                </div>
              )}
              {startError && (
                <div className="mt-4 alert-error px-3 py-2 text-xs">
                  {startError}
                </div>
              )}
              {finishError && (
                <div className="mt-4 alert-error px-3 py-2 text-xs">
                  {finishError}
                </div>
              )}
              {isCurrentSessionActive ? (
                <Button
                  className="w-full mt-6"
                  onClick={handleFinishSession}
                  disabled={finishingSession || !activeSession}
                >
                  {finishingSession ? 'Finishing…' : 'Finish Session'}
                </Button>
              ) : (
                <Button className="w-full mt-6" onClick={handleStartSession} disabled={startingSession || hasActiveSession}>
                  {startingSession ? 'Starting…' : 'Start Session'}
                </Button>
              )}
           </Card>

           <Card className="p-6">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Workout Impact</h3>
              {impact ? (
                <div className="space-y-4 text-sm text-muted">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-muted">
                      <Gauge className="mr-2 h-4 w-4 text-subtle" /> Score
                    </div>
                    <span className="font-semibold text-strong">{impact.score}</span>
                  </div>
                  <div className="text-xs text-subtle">
                    Volume +{impact.breakdown.volume}, Intensity +{impact.breakdown.intensity}, Density +{impact.breakdown.density}
                  </div>
                </div>
              ) : planImpact ? (
                <div className="space-y-2 text-sm text-muted">
                  <p>Session impact requires loaded exercises. Showing plan total instead.</p>
                  <p className="text-xs text-subtle">Plan score {planImpact.score}.</p>
                </div>
              ) : (
                <p className="text-sm text-muted">Impact score will appear after generation.</p>
              )}
           </Card>
        </div>
      </div>
      </div>
    </div>
  )
}
