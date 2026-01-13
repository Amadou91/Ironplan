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

  if (loading) return <div className="p-10 text-center text-slate-400">Loading workout...</div>
  if (!workout) return <div className="p-10 text-center text-slate-400">Workout not found.</div>

  const exercises = Array.isArray(workout.exercises)
    ? workout.exercises
    : workout.exercises?.schedule?.flatMap((day) => day.exercises ?? []) ?? []
  const summary = !Array.isArray(workout.exercises) ? workout.exercises?.summary : undefined
  const impact = summary?.impact
  const inputs = !Array.isArray(workout.exercises) ? workout.exercises?.inputs : undefined
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
          started_at: startedAt,
          status: 'active'
        })
        .select()
        .single()

      if (sessionError) throw sessionError
      if (!sessionData) throw new Error('Failed to create session.')

      const exercisePayload = enrichedExercises.map((exercise, index) => ({
        session_id: sessionData.id,
        exercise_name: exercise.name,
        primary_muscle: toMuscleSlug(exercise.primaryMuscle ?? 'Full Body'),
        secondary_muscles: (exercise.secondaryMuscles ?? []).map((muscle) => toMuscleSlug(muscle)),
        order_index: index
      }))

      const { data: sessionExercises, error: exerciseError } = await supabase
        .from('session_exercises')
        .insert(exercisePayload)
        .select('id, exercise_name, primary_muscle, secondary_muscles, order_index')
        .order('order_index', { ascending: true })

      if (exerciseError) throw exerciseError

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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <button onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center text-sm mb-6">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {sessionActive && (activeSession || sessionId) && <ActiveSession sessionId={sessionId} />}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{workout.title}</h1>
              <p className="text-slate-400">{workout.description}</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              {workout.goal}
            </span>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Activity className="w-5 h-5 mr-2 text-emerald-500" />
              Regimen
            </h3>
            <div className="space-y-3">
              {enrichedExercises.map((ex, idx) => {
                const metrics = computeMetrics(ex)
                const primaryParts = ex.primaryMuscle ? toMuscleLabel(ex.primaryMuscle) : '—'
                const secondaryParts = ex.secondaryMuscles?.length ? ex.secondaryMuscles.map((muscle) => toMuscleLabel(muscle)).join(', ') : '—'

                return (
                  <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
                          {idx + 1}
                        </div>
                        <div className="space-y-2">
                          <div>
                            <h4 className="font-medium text-white">{ex.name}</h4>
                            <p className="text-xs text-slate-400">{ex.load?.label ?? 'Target: General'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                            <span className="rounded-full border border-slate-600/60 bg-slate-900/40 px-2 py-0.5">
                              Primary: {primaryParts ?? '—'}
                            </span>
                            <span className="rounded-full border border-slate-600/60 bg-slate-900/40 px-2 py-0.5">
                              Secondary: {secondaryParts ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-300 font-mono">
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
           <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Program Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                   <div className="flex items-center text-slate-300">
                     <Clock className="w-4 h-4 mr-2 text-slate-500" /> Duration
                   </div>
                   <span className="text-white font-medium">{summary?.totalMinutes ?? '~60'} min</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                   <div className="flex items-center text-slate-300">
                     <Flame className="w-4 h-4 mr-2 text-slate-500" /> Intensity
                   </div>
                   <span className="text-white font-medium capitalize">{inputs?.intensity ?? 'Moderate'}</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center text-slate-300">
                     <Trophy className="w-4 h-4 mr-2 text-slate-500" /> Level
                   </div>
                   <span className="text-white font-medium capitalize">{workout.level}</span>
                </div>
              </div>
              {sessionActive && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  Session active. Log your sets below to track progress.
                </div>
              )}
              {startError && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {startError}
                </div>
              )}
              <Button className="w-full mt-6" onClick={handleStartSession} disabled={startingSession}>
                {startingSession ? 'Starting…' : 'Start Session'}
              </Button>
           </Card>

           <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Workout Impact</h3>
              {impact ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-slate-300">
                      <Gauge className="w-4 h-4 mr-2 text-slate-500" /> Score
                    </div>
                    <span className="text-white font-semibold">{impact.score}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Volume +{impact.breakdown.volume}, Intensity +{impact.breakdown.intensity}, Density +{impact.breakdown.density}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Impact score will appear after generation.</p>
              )}
           </Card>
        </div>
      </div>
    </div>
  )
}
