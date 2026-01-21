'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Clock, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { normalizePlanInput } from '@/lib/generator'
import { createWorkoutSession } from '@/lib/session-creation'
import { fetchTemplateHistory } from '@/lib/session-history'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { computeReadinessScore, getReadinessIntensity, getReadinessLevel, type ReadinessSurvey } from '@/lib/training-metrics'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { FocusArea, PlanInput } from '@/types/domain'

type WorkoutTemplate = {
  id: string
  title: string
  description: string | null
  focus: FocusArea
  style: PlanInput['goals']['primary']
  experience_level: PlanInput['experienceLevel']
  intensity: PlanInput['intensity']
  template_inputs: PlanInput | null
  created_at: string
}

type SessionIntensitySetting = {
  value: number
  label: string
  intensity: PlanInput['intensity']
  experienceDelta: -1 | 0 | 1
  restPreference: PlanInput['preferences']['restPreference']
  helper: string
}

type ReadinessSurveyDraft = {
  [Key in keyof ReadinessSurvey]: number | null
}

const EXPERIENCE_LEVELS: PlanInput['experienceLevel'][] = ['beginner', 'intermediate', 'advanced']

const SESSION_INTENSITY_LEVELS: SessionIntensitySetting[] = [
  {
    value: 1,
    label: 'Ease in',
    intensity: 'low',
    experienceDelta: -1,
    restPreference: 'high_recovery',
    helper: 'Lower intensity with extra recovery and a simpler exercise mix.'
  },
  {
    value: 2,
    label: 'Steady',
    intensity: 'moderate',
    experienceDelta: 0,
    restPreference: 'balanced',
    helper: 'Balanced intensity and rest with your usual exercise mix.'
  },
  {
    value: 3,
    label: 'Push',
    intensity: 'high',
    experienceDelta: 1,
    restPreference: 'minimal_rest',
    helper: 'Higher intensity with shorter rest and a tougher exercise mix.'
  }
]

const READINESS_FIELDS: Array<{
  key: keyof ReadinessSurvey
  label: string
  helper: string
}> = [
  { key: 'sleep', label: 'Sleep Quality', helper: '1 = poor, 5 = great' },
  { key: 'soreness', label: 'Muscle Soreness', helper: '1 = fresh, 5 = very sore' },
  { key: 'stress', label: 'Stress Level', helper: '1 = calm, 5 = high stress' },
  { key: 'motivation', label: 'Motivation', helper: '1 = low, 5 = high' }
]

const shiftExperienceLevel = (base: PlanInput['experienceLevel'], delta: -1 | 0 | 1) => {
  const index = EXPERIENCE_LEVELS.indexOf(base)
  if (index === -1) return base
  const nextIndex = Math.max(0, Math.min(EXPERIENCE_LEVELS.length - 1, index + delta))
  return EXPERIENCE_LEVELS[nextIndex]
}

export default function WorkoutStartPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const { user } = useUser()
  const startSession = useWorkoutStore((state) => state.startSession)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingSession, setStartingSession] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [minutesAvailable, setMinutesAvailable] = useState(45)
  const [readinessSurvey, setReadinessSurvey] = useState<ReadinessSurveyDraft>({
    sleep: null,
    soreness: null,
    stress: null,
    motivation: null
  })
  const [bodyWeight, setBodyWeight] = useState<string>('')

  const hasActiveSession = Boolean(activeSession)
  const activeSessionLink = activeSession?.templateId
    ? `/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=workouts`
    : '/dashboard'

  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('weight_lb').eq('id', user.id).single()
      if (data?.weight_lb) {
        setBodyWeight(String(data.weight_lb))
      }
    }
    fetchProfile()
  }, [user, supabase])

  useEffect(() => {
    const fetchTemplate = async () => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) {
        console.error('Error fetching template:', error)
      } else {
        setTemplate(data)
        const defaultMinutes = data?.template_inputs?.time?.minutesPerSession ?? 45
        setMinutesAvailable(defaultMinutes)
      }
      setLoading(false)
    }

    if (params.id) fetchTemplate()
  }, [params.id, supabase])

  const readinessComplete = useMemo(
    () => READINESS_FIELDS.every((field) => typeof readinessSurvey[field.key] === 'number'),
    [readinessSurvey]
  )
  const readinessScore = useMemo(
    () => (readinessComplete ? computeReadinessScore(readinessSurvey as ReadinessSurvey) : null),
    [readinessComplete, readinessSurvey]
  )
  const readinessLevel = useMemo(
    () => (typeof readinessScore === 'number' ? getReadinessLevel(readinessScore) : null),
    [readinessScore]
  )

  const equipmentSummary = useMemo(() => {
    const inventory = template?.template_inputs?.equipment?.inventory
    if (!inventory) return []
    const labels = [] as string[]
    if (inventory.bodyweight) labels.push('Bodyweight')
    if (inventory.dumbbells?.length) labels.push(`Dumbbells (${inventory.dumbbells.join(', ')} lb)`)
    if (inventory.kettlebells?.length) labels.push(`Kettlebells (${inventory.kettlebells.join(', ')} lb)`)
    if (inventory.bands?.length) labels.push(`Bands (${inventory.bands.join(', ')})`)
    if (inventory.barbell?.available) labels.push('Barbell')
    const machines = inventory.machines
      ? Object.entries(inventory.machines)
          .filter(([, available]) => available)
          .map(([machine]) => machine.replace('_', ' '))
      : []
    if (machines.length) labels.push(`Machines (${machines.join(', ')})`)
    return labels
  }, [template])

  const baseIntensity = useMemo(
    () => template?.template_inputs?.intensity ?? template?.intensity ?? 'moderate',
    [template]
  )
  const selectedIntensity = useMemo(() => {
    const intensityKey = readinessLevel ? getReadinessIntensity(readinessLevel) : baseIntensity
    return SESSION_INTENSITY_LEVELS.find((option) => option.intensity === intensityKey) ?? SESSION_INTENSITY_LEVELS[1]
  }, [baseIntensity, readinessLevel])

  const updateReadinessField = (field: keyof ReadinessSurvey, value: number) => {
    setReadinessSurvey((prev) => ({ ...prev, [field]: value }))
  }

  const applySessionIntensity = (input: PlanInput) => {
    const adjustedExperience = shiftExperienceLevel(input.experienceLevel, selectedIntensity.experienceDelta)
    return {
      ...input,
      intensity: selectedIntensity.intensity,
      experienceLevel: adjustedExperience,
      preferences: {
        ...input.preferences,
        restPreference: selectedIntensity.restPreference
      }
    }
  }

  const handleStartSession = async () => {
    if (!template) return
    if (!user) {
      setStartError('Please sign in again to start a session.')
      return
    }
    if (!readinessComplete || readinessScore === null || !readinessLevel) {
      setStartError('Complete the readiness check before starting the session.')
      return
    }
    if (hasActiveSession) {
      setStartError('Finish your current session before starting a new one.')
      router.push(activeSessionLink)
      return
    }
    setStartError(null)
    setStartingSession(true)

    try {
      if (bodyWeight) {
        const weightVal = parseFloat(bodyWeight)
        if (!isNaN(weightVal)) {
          await supabase.from('profiles').update({ weight_lb: weightVal }).eq('id', user.id)
          await supabase.from('body_measurements').insert({ user_id: user.id, weight_lb: weightVal })
        }
      }

      const normalizedInputs = normalizePlanInput(template.template_inputs ?? {})
      const baseExperience =
        template.template_inputs?.experienceLevel ?? template.experience_level ?? normalizedInputs.experienceLevel
      const tunedInputs = applySessionIntensity({ ...normalizedInputs, experienceLevel: baseExperience })
      const history = await fetchTemplateHistory(supabase, template.id)
      const nameSuffix = `${toMuscleLabel(template.focus)} ${template.style.replace('_', ' ')}`
      const sessionNotes = {
        sessionIntensity: selectedIntensity.intensity,
        minutesAvailable,
        readiness: readinessLevel,
        readinessScore,
        readinessSurvey: readinessSurvey as ReadinessSurvey,
        source: 'workout_start'
      }
      const { sessionId, startedAt, sessionName, exercises, impact, timezone, sessionNotes: storedNotes } =
        await createWorkoutSession({
          supabase,
          userId: user.id,
          templateId: template.id,
          templateTitle: buildWorkoutDisplayName({
            focus: template.focus,
            style: template.style,
            intensity: template.intensity,
            minutes: template.template_inputs?.time?.minutesPerSession ?? null,
            fallback: template.title
          }),
          focus: template.focus,
          goal: template.style,
          input: tunedInputs,
          minutesAvailable,
          readiness: {
            survey: readinessSurvey as ReadinessSurvey,
            score: readinessScore,
            level: readinessLevel
          },
          sessionNotes,
          history,
          nameSuffix
        })

      startSession({
        id: sessionId,
        userId: user.id,
        templateId: template.id,
        name: sessionName,
        startedAt,
        status: 'in_progress',
        impact,
        exercises,
        timezone,
        sessionNotes: storedNotes
      })

      router.push(`/workouts/${template.id}/active?sessionId=${sessionId}&from=start`)
    } catch (error) {
      console.error('Failed to start session', error)
      setStartError('Unable to start the session. Please try again.')
    } finally {
      setStartingSession(false)
    }
  }

  if (loading) return <div className="page-shell p-10 text-center text-muted">Loading session setup...</div>
  if (!template) return <div className="page-shell p-10 text-center text-muted">Template not found.</div>

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href="/workouts" className="transition-colors hover:text-strong">
                Workouts
              </Link>
              <span>/</span>
              <span className="text-subtle">
                {buildWorkoutDisplayName({
                  focus: template.focus,
                  style: template.style,
                  intensity: template.intensity,
                  minutes: template.template_inputs?.time?.minutesPerSession ?? null,
                  fallback: template.title
                })}
              </span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-strong">
              Start{' '}
              {buildWorkoutDisplayName({
                focus: template.focus,
                style: template.style,
                intensity: template.intensity,
                minutes: template.template_inputs?.time?.minutesPerSession ?? null,
                fallback: template.title
              })}
            </h1>
            {template.description && <p className="text-sm text-muted">{template.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push(`/workout/${template.id}`)}>
              Preview
            </Button>
          </div>
        </div>

        {startError && <div className="alert-error p-4 text-sm">{startError}</div>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-strong">Session settings</h2>
              </div>
              <p className="mt-2 text-sm text-muted">
                Set your available time and complete the readiness check so we can tune the session.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-subtle">
                    <span>Minutes available</span>
                    <span className="text-strong">{minutesAvailable} min</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={5}
                    value={minutesAvailable}
                    onChange={(event) => setMinutesAvailable(Number(event.target.value))}
                    className="mt-3 w-full"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[30, 45, 60, 75].map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={minutesAvailable === value ? 'primary' : 'secondary'}
                        onClick={() => setMinutesAvailable(value)}
                      >
                        {value} min
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-subtle">
                    <span>Readiness check (required)</span>
                    <span className="text-strong">
                      {typeof readinessScore === 'number' ? `${readinessScore}/100 · ${readinessLevel}` : 'Incomplete'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Rate each metric 1-5 before you can start the session.
                  </p>
                  <div className="mt-4 space-y-4">
                    {READINESS_FIELDS.map((field) => (
                      <div key={field.key} className="rounded-xl border border-[var(--color-border)] p-3">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-subtle">
                          <span>{field.label}</span>
                          <span>{readinessSurvey[field.key] ?? 'N/A'}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <Button
                              key={`${field.key}-${value}`}
                              type="button"
                              size="sm"
                              variant={readinessSurvey[field.key] === value ? 'primary' : 'secondary'}
                              onClick={() => updateReadinessField(field.key, value)}
                              className="h-9 w-full px-0 text-xs"
                            >
                              {value}
                            </Button>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] text-subtle">{field.helper}</p>
                      </div>
                    ))}
                  </div>
                  {!readinessComplete && (
                    <p className="mt-3 text-xs text-[var(--color-danger)]">
                      Complete all readiness ratings to unlock the start button.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-subtle">
                    <span>Bodyweight (optional)</span>
                    <span className="text-strong">{bodyWeight ? `${bodyWeight} lb` : 'Not set'}</span>
                  </div>
                  <div className="mt-2">
                    <input
                      type="number"
                      placeholder="Enter weight in lb"
                      value={bodyWeight}
                      onChange={(e) => setBodyWeight(e.target.value)}
                      className="input-base w-full"
                    />
                    <p className="mt-1 text-[10px] text-subtle">Updated weight will be saved to your profile history.</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-strong">Session preview</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                  <p className="text-xs text-subtle">Focus</p>
                  <p className="font-semibold text-strong">{toMuscleLabel(template.focus)}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                  <p className="text-xs text-subtle">Style</p>
                  <p className="font-semibold text-strong">{template.style.replace('_', ' ')}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                  <p className="text-xs text-subtle">Session intensity</p>
                  <p className="font-semibold text-strong">
                    {readinessLevel ? selectedIntensity.label : 'Pending readiness'}
                  </p>
                </div>
              </div>
              {equipmentSummary.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-subtle">Equipment</p>
                  <p className="text-sm text-muted">{equipmentSummary.join(' · ')}</p>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong">Ready to train?</h2>
              <p className="mt-2 text-sm text-muted">
                We will adapt this plan to your time, readiness, and equipment.
              </p>
              <Button
                type="button"
                onClick={handleStartSession}
                disabled={startingSession || hasActiveSession || !readinessComplete}
                className="mt-4 w-full justify-center"
              >
                {hasActiveSession
                  ? 'Session Active'
                  : startingSession
                    ? 'Starting...'
                    : 'Start Session'}
              </Button>
              <p className="mt-3 text-xs text-subtle">
                {readinessLevel
                  ? `Readiness is ${readinessLevel}. Intensity set to ${selectedIntensity.label}.`
                  : 'Complete readiness to set intensity.'}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
