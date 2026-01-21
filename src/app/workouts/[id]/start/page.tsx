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
  const [readiness, setReadiness] = useState<'low' | 'steady' | 'high'>('steady')

  const hasActiveSession = Boolean(activeSession)
  const activeSessionLink = activeSession?.templateId
    ? `/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=workouts`
    : '/dashboard'

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

  const handleStartSession = async () => {
    if (!template) return
    if (!user) {
      setStartError('Please sign in again to start a session.')
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
      const normalizedInputs = normalizePlanInput(template.template_inputs ?? {})
      const history = await fetchTemplateHistory(supabase, template.id)
      const nameSuffix = `${toMuscleLabel(template.focus)} ${template.style.replace('_', ' ')}`
      const { sessionId, startedAt, sessionName, exercises, impact, timezone, sessionNotes } =
        await createWorkoutSession({
          supabase,
          userId: user.id,
          templateId: template.id,
          templateTitle: template.title,
          focus: template.focus,
          goal: template.style,
          input: normalizedInputs,
          minutesAvailable,
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
        sessionNotes
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
              <span className="text-subtle">{template.title}</span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-strong">Start {template.title}</h1>
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
                Set your available time and readiness so we can tune the session intensity.
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
                  <p className="text-xs text-subtle">Readiness check</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(['low', 'steady', 'high'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReadiness(value)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] ${
                          readiness === value
                            ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                            : 'border-[var(--color-border)] text-muted hover:text-strong'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
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
                  <p className="text-xs text-subtle">Experience</p>
                  <p className="font-semibold text-strong">{template.experience_level}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                  <p className="text-xs text-subtle">Intensity</p>
                  <p className="font-semibold text-strong">{template.intensity}</p>
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
                disabled={startingSession || hasActiveSession}
                className="mt-4 w-full justify-center"
              >
                {hasActiveSession
                  ? 'Session Active'
                  : startingSession
                    ? 'Starting...'
                    : 'Start Session'}
              </Button>
              <p className="mt-3 text-xs text-subtle">
                Readiness set to <span className="text-strong">{readiness}</span>.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
