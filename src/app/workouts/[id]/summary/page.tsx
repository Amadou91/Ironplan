'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { computeSetE1rm, computeSetTonnage } from '@/lib/session-metrics'
import { computeSessionMetrics, type ReadinessSurvey } from '@/lib/training-metrics'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import { useUser } from '@/hooks/useUser'
import type { FocusArea, Goal, Intensity, PlanInput } from '@/types/domain'

type SessionDetail = {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  status: string | null
  session_notes: string | null
  body_weight_lb: number | null
  impact: {
    score?: number
    breakdown?: {
      volume?: number
      intensity?: number
      density?: number
    }
  } | null
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    sets: Array<{
      id: string
      reps: number | null
      weight: number | null
      rpe: number | null
      rir: number | null
      completed: boolean | null
      performed_at: string | null
      weight_unit: string | null
    }>
  }>
  template?: {
    id: string
    title: string
    focus: FocusArea
    style: PlanInput['goals']['primary']
    intensity: PlanInput['intensity']
    template_inputs: PlanInput | null
  } | null
}

type SessionNotes = {
  sessionIntensity?: Intensity
  readiness?: 'low' | 'steady' | 'high'
  readinessScore?: number
  readinessSurvey?: ReadinessSurvey
  minutesAvailable?: number
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 'N/A'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'N/A'
  const diff = Math.max(0, endDate.getTime() - startDate.getTime())
  const minutes = Math.round(diff / 60000)
  return `${minutes} min`
}

const parseSessionNotes = (notes?: string | null): SessionNotes | null => {
  if (!notes) return null
  try {
    return JSON.parse(notes) as SessionNotes
  } catch {
    return null
  }
}

const formatSessionIntensity = (intensity?: Intensity | null) => {
  if (!intensity) return null
  if (intensity === 'low') return 'Ease in'
  if (intensity === 'high') return 'Push'
  return 'Steady'
}

const getSessionIntensity = (notes?: SessionNotes | null): Intensity | null => {
  if (!notes) return null
  if (notes.sessionIntensity) return notes.sessionIntensity
  if (!notes.readiness) return null
  if (notes.readiness === 'low') return 'low'
  if (notes.readiness === 'high') return 'high'
  return 'moderate'
}

export default function WorkoutSummaryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { user } = useUser()
  const sessionId = searchParams.get('sessionId')
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(sessionId))
  const [error, setError] = useState<string | null>(null)

  const parsedNotes = useMemo(() => parseSessionNotes(session?.session_notes ?? null), [session?.session_notes])
  const intensityLabel = formatSessionIntensity(getSessionIntensity(parsedNotes))
  const sessionTitle = useMemo(() => {
    if (!session) return ''
    return buildWorkoutDisplayName({
      focus: session.template?.focus ?? null,
      style: session.template?.style ?? null,
      intensity: session.template?.intensity ?? null,
      minutes: parsedNotes?.minutesAvailable ?? session.template?.template_inputs?.time?.minutesPerSession ?? null,
      fallback: session.name
    })
  }, [parsedNotes?.minutesAvailable, session])

  useEffect(() => {
    if (!sessionId) return

    const loadSession = async () => {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select(
          'id, name, started_at, ended_at, status, session_notes, body_weight_lb, impact, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, sets(id, reps, weight, rpe, rir, completed, performed_at, weight_unit)), template:workout_templates(id, title, focus, style, intensity, template_inputs)'
        )
        .eq('id', sessionId)
        .single()
      if (fetchError) {
        console.error('Failed to load session summary', fetchError)
        setError('Unable to load session summary. Please try again.')
      } else {
        setSession(data as unknown as SessionDetail)
      }
      setLoading(false)
    }

    loadSession()
  }, [sessionId, supabase])

  const sessionMetrics = useMemo(() => {
    if (!session) {
      return {
        totalSets: 0,
        totalReps: 0,
        tonnage: 0,
        hardSets: 0,
        bestE1rm: 0,
        avgEffort: null,
        avgIntensity: null,
        avgRestSeconds: null,
        workload: 0,
        density: null,
        sessionRpe: null,
        sRpeLoad: null
      }
    }

    const sessionGoal = session.template?.style as Goal | undefined
    const exerciseLibraryByName = new Map(EXERCISE_LIBRARY.map((ex) => [ex.name.toLowerCase(), ex]))

    const metricSets = session.session_exercises.flatMap((exercise) => {
      const libMatch = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())
      const isEligible = libMatch?.e1rmEligible

      return exercise.sets
        .filter((set) => set.completed !== false)
        .map((set) => ({
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
          rpe: typeof set.rpe === 'number' ? set.rpe : null,
          rir: typeof set.rir === 'number' ? set.rir : null,
          performedAt: set.performed_at ?? null,
          completed: set.completed,
          sessionGoal,
          isEligible
        }))
    })

    const metrics = computeSessionMetrics({
      startedAt: session.started_at,
      endedAt: session.ended_at,
      intensity: getSessionIntensity(parsedNotes),
      sets: metricSets
    })

    const bestE1rm = metricSets.reduce((best, item) => {
      const val = computeSetE1rm(item, item.sessionGoal, item.isEligible)
      return val ? Math.max(best, val) : best
    }, 0)

    return {
      ...metrics,
      bestE1rm: Math.round(bestE1rm)
    }
  }, [parsedNotes, session])

  const effortInsight = useMemo(() => {
    if (!sessionMetrics.avgEffort) return null
    if (parsedNotes?.readiness === 'low' && sessionMetrics.avgEffort >= 8) {
      return 'You pushed hard on a low-readiness day. Plan extra recovery before the next session.'
    }
    if (parsedNotes?.readiness === 'high' && sessionMetrics.avgEffort <= 7) {
      return 'Readiness was high but effort stayed controlled. Consider a small load bump next time.'
    }
    return null
  }, [parsedNotes?.readiness, sessionMetrics.avgEffort])

  const exerciseHighlights = useMemo(() => {
    if (!session) return []
    const totals = session.session_exercises.map((exercise) => {
      const volume = exercise.sets.reduce((sum, set) => {
        if (set.completed === false) return sum
        return sum + computeSetTonnage({
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
        })
      }, 0)
      return {
        name: exercise.exercise_name,
        muscle: exercise.primary_muscle,
        volume: Math.round(volume)
      }
    })
    return totals.sort((a, b) => b.volume - a.volume).slice(0, 3)
  }, [session])

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleBodyWeightUpdate = (value: string) => {
    if (!session || !user) return
    const weightVal = parseFloat(value)
    setSession(prev => prev ? { ...prev, body_weight_lb: isNaN(weightVal) ? null : weightVal } : prev)
    
    if (!isNaN(weightVal)) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          await Promise.all([
            supabase.from('sessions').update({ body_weight_lb: weightVal }).eq('id', session.id),
            supabase.from('profiles').update({ weight_lb: weightVal }).eq('id', user.id),
            supabase.from('body_measurements').insert({ user_id: user.id, weight_lb: weightVal, recorded_at: session.started_at })
          ])
        } catch (error) {
          console.error('Failed to update body weight from summary', error)
        }
      }, 1000);
    }
  }

  if (loading) {
    return <div className="page-shell p-10 text-center text-muted">Loading session summary...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to view your summary.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  if (!sessionId || !session) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Session summary unavailable.</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Today</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-success)]">Workout complete</p>
            <h1 className="font-display text-3xl font-semibold text-strong">{sessionTitle}</h1>
            <p className="mt-2 text-sm text-muted">
              {formatDateTime(session.started_at)} · {formatDuration(session.started_at, session.ended_at)}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-1.5">
                <span className="text-xs font-medium text-subtle">Body weight:</span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="lb"
                  value={session.body_weight_lb ?? ''}
                  onChange={(e) => handleBodyWeightUpdate(e.target.value)}
                  className="w-16 bg-transparent text-sm font-semibold text-strong outline-none"
                />
                <span className="text-[10px] text-subtle">lb</span>
              </div>
            </div>
            {(intensityLabel || parsedNotes?.minutesAvailable) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
                {intensityLabel && <span className="badge-neutral">Intensity: {intensityLabel}</span>}
                {parsedNotes?.minutesAvailable && (
                  <span className="badge-neutral">{parsedNotes.minutesAvailable} min plan</span>
                )}
                {typeof parsedNotes?.readinessScore === 'number' && (
                  <span className="badge-neutral">Readiness {parsedNotes.readinessScore}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard">
              <Button size="sm">Back to Today</Button>
            </Link>
            <Link href="/progress">
              <Button variant="secondary" size="sm">View Progress</Button>
            </Link>
          </div>
        </div>

        {error && <div className="alert-error p-4 text-sm">{error}</div>}

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />
              <h2 className="text-lg font-semibold text-strong">Session highlights</h2>
            </div>
            {session.impact?.score ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="badge-success">Impact score {Math.round(session.impact.score)}</span>
                <span className="text-subtle">
                  Volume {Math.round(session.impact.breakdown?.volume ?? 0)} · Intensity {Math.round(session.impact.breakdown?.intensity ?? 0)}
                </span>
              </div>
            ) : null}
            {effortInsight && (
              <p className="mt-2 text-xs text-subtle">{effortInsight}</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--color-border)] p-4 text-sm">
                <p className="text-xs text-subtle">Total sets</p>
                <p className="text-2xl font-semibold text-strong">{sessionMetrics.totalSets}</p>
                <p className="text-xs text-subtle">{sessionMetrics.totalReps} reps logged</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-4 text-sm">
                <p className="text-xs text-subtle">Workload</p>
                <p className="text-2xl font-semibold text-strong">{sessionMetrics.workload}</p>
                <p className="text-xs text-subtle">
                  {sessionMetrics.tonnage} tonnage · {sessionMetrics.hardSets} hard sets · sRPE {sessionMetrics.sRpeLoad ?? 'N/A'}
                </p>
              </div>
              {sessionMetrics.bestE1rm > 0 && (
                <div className="rounded-lg border border-[var(--color-border)] p-4 text-sm">
                  <p className="text-xs text-subtle">Best e1RM</p>
                  <p className="text-2xl font-semibold text-strong">{sessionMetrics.bestE1rm}</p>
                  <p className="text-xs text-subtle">Avg intensity {sessionMetrics.avgIntensity ?? 'N/A'}</p>
                </div>
              )}
              <div className="rounded-lg border border-[var(--color-border)] p-4 text-sm">
                <p className="text-xs text-subtle">Average effort</p>
                <p className="text-2xl font-semibold text-strong">
                  {sessionMetrics.avgEffort ?? 'N/A'}
                </p>
                <p className="text-xs text-subtle">
                  Rest {sessionMetrics.avgRestSeconds ?? 'N/A'}s · Density {sessionMetrics.density ?? 'N/A'}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.2em] text-subtle">Top exercises</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                {exerciseHighlights.map((exercise) => (
                  <div key={exercise.name} className="flex flex-col justify-between rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-strong">{exercise.name}</p>
                      <p className="text-xs text-subtle">{exercise.muscle ? toMuscleLabel(exercise.muscle) : 'Primary muscle'}</p>
                    </div>
                    <span className="mt-2 text-sm text-muted font-medium">{exercise.volume} tonnage</span>
                  </div>
                ))}
                {exerciseHighlights.length === 0 && (
                  <p className="text-sm text-muted">No completed sets logged.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}