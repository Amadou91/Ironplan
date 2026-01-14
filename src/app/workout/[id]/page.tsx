'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Activity, Clock, Flame, Trophy, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PlanInput, WorkoutImpact } from '@/types/domain'
import { enhanceExerciseData, toMuscleLabel, toMuscleSlug } from '@/lib/muscle-utils'
import ActiveSession from '@/components/workout/ActiveSession'
import { useWorkoutStore } from '@/store/useWorkoutStore'

// Define types based on your DB schema
type Exercise = {
  name: string
  sets: number
  reps: string | number
  rpe: number
  focus?: string
  primaryBodyParts?: string[]
  secondaryBodyParts?: string[]
  primaryMuscle?: string
  secondaryMuscles?: string[]
  durationMinutes?: number
  restSeconds?: number
  load?: { label: string }
}

type Workout = {
  id: string
  title: string
  description: string
  goal: string
  level: string
  exercises:
    | { schedule?: { exercises?: Exercise[] }[]; summary?: { totalMinutes?: number; impact?: WorkoutImpact }; inputs?: PlanInput }
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
  const startSession = useWorkoutStore((state) => state.startSession)
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

  const exercises = useMemo(() => {
    if (!workout?.exercises) return []
    return Array.isArray(workout.exercises)
      ? workout.exercises
      : workout.exercises.schedule?.flatMap((day) => day.exercises ?? []) ?? []
  }, [workout])

  const summary = useMemo(
    () => (!workout?.exercises || Array.isArray(workout.exercises) ? undefined : workout.exercises.summary),
    [workout]
  )

  const inputs = useMemo(
    () => (!workout?.exercises || Array.isArray(workout.exercises) ? undefined : workout.exercises.inputs),
    [workout]
  )
  const impact = summary?.impact
  const sessionActive = searchParams.get('session') === 'active'
  const sessionId = searchParams.get('sessionId')
  const enrichedExercises = useMemo(
    () =>
      exercises.map((exercise) =>
        enhanceExerciseData({
          ...exercise,
          primaryMuscle: exercise.primaryBodyParts?.[0] ?? exercise.focus ?? ''
        })
      ),
    [exercises]
  )

  if (loading) return <div className="page-shell p-10 text-center text-muted">Loading workout...</div>
  if (!workout) return <div className="page-shell p-10 text-center text-muted">Workout not found.</div>

  // Per-workout metrics are computed here from each exercise's sets/reps/RPE data.
  // Assumptions: reps ranges are averaged, RPE is on a 1–10 scale, and density uses a
  // default 2 minutes per set when duration/rest data is missing.
  // Missing data is handled by returning null and rendering a "—" placeholder.
  const parseReps = (reps: Exercise['reps']) => {
    if (typeof reps === 'number' && Number.isFinite(reps)) return reps
    if (typeof reps !== 'string') return null
    const matches = reps.match(/\d+/g)
    if (!matches?.length) return null
    const numbers = matches.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)
    if (!numbers.length) return null
    if (numbers.length === 1) return numbers[0]
    return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
  }

  const computeMetrics = (exercise: Exercise) => {
    const repsValue = parseReps(exercise.reps)
    const volume = repsValue && exercise.sets ? repsValue * exercise.sets : null
    const estimatedMinutes =
      exercise.durationMinutes ??
      (exercise.restSeconds ? (exercise.restSeconds * exercise.sets) / 60 : exercise.sets * 2)
    const density = volume && estimatedMinutes ? Number((volume / estimatedMinutes).toFixed(1)) : null
    const intensity = Number.isFinite(exercise.rpe) ? exercise.rpe : null
    return { volume, density, intensity }
  }

  const handleStartSession = async () => {
    setStartError(null)
    setStartingSession(true)
    try {
      if (!workout?.id) throw new Error('Missing workout id.')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const startedAt = new Date().toISOString()
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          workout_id: workout.id,
          name: workout.title,
          started_at: startedAt
        })
        .select()
        .single()

      if (sessionError) throw sessionError
      if (!sessionData) throw new Error('Failed to create session.')

      const exercisePayload = enrichedExercises.map((exercise, index) => {
        const primaryMuscle = toMuscleSlug(exercise.primaryMuscle ?? 'Full Body', 'full_body')
        const secondaryMuscles = (exercise.secondaryMuscles ?? [])
          .map((muscle) => toMuscleSlug(muscle, null))
          .filter((muscle): muscle is string => Boolean(muscle))
        return {
          session_id: sessionData.id,
          exercise_name: exercise.name,
          primary_muscle: primaryMuscle,
          secondary_muscles: secondaryMuscles,
          order_index: index
        }
      })

      let sessionExercises: Array<{
        id: string
        exercise_name: string
        primary_muscle: string | null
        secondary_muscles: string[] | null
        order_index: number | null
      }> = []
      if (exercisePayload.length > 0) {
        const { data: insertedExercises, error: exerciseError } = await supabase
          .from('session_exercises')
          .insert(exercisePayload)
          .select('id, exercise_name, primary_muscle, secondary_muscles, order_index')
          .order('order_index', { ascending: true })

        if (exerciseError) throw exerciseError
        sessionExercises = insertedExercises ?? []
      }

      startSession({
        id: sessionData.id,
        userId: user.id,
        workoutId: workout.id,
        name: workout.title,
        startedAt,
        status: 'active',
        exercises: (sessionExercises ?? []).map((exercise, idx) => ({
          id: exercise.id,
          sessionId: sessionData.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
          secondaryMuscles: (exercise.secondary_muscles ?? []).map((muscle) => toMuscleLabel(muscle)),
          sets: [],
          orderIndex: exercise.order_index ?? idx
        }))
      })

      router.push(`/workout/${workout.id}?session=active&sessionId=${sessionData.id}`)
    } catch (error) {
      console.error('Failed to start session', error)
      setStartError('Unable to start the session. Please try again.')
    } finally {
      setStartingSession(false)
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
            <div className="space-y-3">
              {enrichedExercises.map((ex, idx) => {
                const metrics = computeMetrics(ex)
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
                      <div className="flex flex-wrap gap-3 text-xs font-mono text-muted">
                        <span>{ex.sets} sets</span>
                        <span>{ex.reps} reps</span>
                        <span>Vol {metrics.volume ?? '—'}</span>
                        <span>Int {metrics.intensity ?? '—'}</span>
                        <span>Den {metrics.density ?? '—'}</span>
                      </div>
                    </div>
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
                   <span className="font-medium text-strong">{summary?.totalMinutes ?? '~60'} min</span>
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
              {sessionActive && (
                <div className="mt-4 rounded-md border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-3 py-2 text-xs font-medium text-[var(--color-primary-strong)]">
                  Session active. Log your sets below to track progress.
                </div>
              )}
              {startError && (
                <div className="mt-4 alert-error px-3 py-2 text-xs">
                  {startError}
                </div>
              )}
              <Button className="w-full mt-6" onClick={handleStartSession} disabled={startingSession}>
                {startingSession ? 'Starting…' : 'Start Session'}
              </Button>
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
              ) : (
                <p className="text-sm text-muted">Impact score will appear after generation.</p>
              )}
           </Card>
        </div>
      </div>
    </div>
  )
}
