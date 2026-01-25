'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeSetE1rm, computeSetTonnage } from '@/lib/session-metrics'
import { computeSessionMetrics, type ReadinessSurvey } from '@/lib/training-metrics'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import { useUser } from '@/hooks/useUser'
import type { FocusArea, Goal, Intensity, PlanInput } from '@/types/domain'
import { SummaryHeader } from '@/components/workout/SummaryHeader'
import { SessionHighlights } from '@/components/workout/SessionHighlights'
import { ExerciseHighlights } from '@/components/workout/ExerciseHighlights'

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
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
  try { return JSON.parse(notes) as SessionNotes } catch { return null }
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
      minutes: typeof parsedNotes?.minutesAvailable === 'number' ? parsedNotes.minutesAvailable : null,
      fallback: session.name,
      cardioExerciseName: session.template?.style === 'cardio' && session.session_exercises?.[0]?.exercise_name ? session.session_exercises[0].exercise_name : null
    })
  }, [parsedNotes?.minutesAvailable, session])

  useEffect(() => {
    if (!sessionId) return
    const loadSession = async () => {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select('id, name, started_at, ended_at, status, session_notes, body_weight_lb, impact, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, sets(id, reps, weight, rpe, rir, completed, performed_at, weight_unit)), template:workout_templates(id, title, focus, style, intensity, template_inputs)')
        .eq('id', sessionId).single()
      if (fetchError) setError('Unable to load session summary.')
      else setSession(data as unknown as SessionDetail)
      setLoading(false)
    }
    loadSession()
  }, [sessionId, supabase])

  const sessionMetrics = useMemo(() => {
    if (!session) return null
    const sessionGoal = session.template?.style as Goal | undefined
    const exerciseLibraryByName = new Map(EXERCISE_LIBRARY.map(ex => [ex.name.toLowerCase(), ex]))
    const metricSets = session.session_exercises.flatMap(exercise => {
      const isEligible = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())?.e1rmEligible
      return exercise.sets.filter(set => set.completed !== false).map(set => ({
        reps: set.reps ?? null, weight: set.weight ?? null, weightUnit: (set.weight_unit as any) ?? null,
        rpe: typeof set.rpe === 'number' ? set.rpe : null, rir: typeof set.rir === 'number' ? set.rir : null,
        performedAt: set.performed_at ?? null, completed: set.completed, durationSeconds: (set as any).duration_seconds ?? null,
        metricProfile: (exercise as any).metric_profile, sessionGoal, isEligible
      }))
    })
    const metrics = computeSessionMetrics({ startedAt: session.started_at, endedAt: session.ended_at, intensity: getSessionIntensity(parsedNotes), sets: metricSets })
    const bestE1rm = metricSets.reduce((best, item) => Math.max(best, computeSetE1rm(item, item.sessionGoal, item.isEligible) || 0), 0)
    return { ...metrics, bestE1rm: Math.round(bestE1rm) }
  }, [parsedNotes, session])

  const effortInsight = useMemo(() => {
    if (!sessionMetrics?.avgEffort) return null
    if (parsedNotes?.readiness === 'low' && sessionMetrics.avgEffort >= 8) return 'You pushed hard on a low-readiness day. Plan extra recovery.'
    if (parsedNotes?.readiness === 'high' && sessionMetrics.avgEffort <= 7) return 'Readiness was high but effort stayed controlled. Consider a load bump.'
    return null
  }, [parsedNotes?.readiness, sessionMetrics?.avgEffort])

  const exerciseHighlights = useMemo(() => {
    if (!session) return []
    return session.session_exercises.map(exercise => ({
      name: exercise.exercise_name, muscle: exercise.primary_muscle,
      volume: Math.round(exercise.sets.reduce((sum, set) => set.completed === false ? sum : sum + computeSetTonnage({ reps: set.reps ?? null, weight: set.weight ?? null, weightUnit: (set.weight_unit as any) ?? null }), 0))
    })).sort((a, b) => b.volume - a.volume).slice(0, 3)
  }, [session])

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleBodyWeightUpdate = (value: string) => {
    if (!session || !user) return
    const weightVal = parseFloat(value)
    setSession(prev => prev ? { ...prev, body_weight_lb: isNaN(weightVal) ? null : weightVal } : prev)
    if (!isNaN(weightVal)) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await Promise.all([
            supabase.from('sessions').update({ body_weight_lb: weightVal }).eq('id', session.id),
            supabase.from('profiles').update({ weight_lb: weightVal }).eq('id', user.id),
            supabase.from('body_measurements').insert({ user_id: user.id, weight_lb: weightVal, recorded_at: session.started_at })
          ])
        } catch (e) { console.error(e) }
      }, 1000)
    }
  }

  if (loading) return <div className="page-shell p-10 text-center text-muted">Loading session summary...</div>
  if (!user) return <div className="page-shell p-10 text-center text-muted"><p className="mb-4">Sign in to view your summary.</p><Button onClick={() => router.push('/auth/login')}>Sign in</Button></div>
  if (!sessionId || !session || !sessionMetrics) return <div className="page-shell p-10 text-center text-muted"><p className="mb-4">Session summary unavailable.</p><Button onClick={() => router.push('/dashboard')}>Back to Today</Button></div>

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <SummaryHeader 
          title={sessionTitle} dateLabel={formatDateTime(session.started_at)} durationLabel={formatDuration(session.started_at, session.ended_at)}
          bodyWeight={session.body_weight_lb} onBodyWeightUpdate={handleBodyWeightUpdate}
          intensityLabel={intensityLabel} minutesPlanned={parsedNotes?.minutesAvailable} readinessScore={parsedNotes?.readinessScore}
          isLb={session.template?.template_inputs?.equipment?.inventory?.barbell?.available ?? true}
        />
        {error && <div className="alert-error p-4 text-sm mb-6">{error}</div>}
        <div className="space-y-6">
          <SessionHighlights impactScore={session.impact?.score} impactBreakdown={session.impact?.breakdown} effortInsight={effortInsight} metrics={sessionMetrics} />
          <ExerciseHighlights highlights={exerciseHighlights} />
        </div>
      </div>
    </div>
  )
}
