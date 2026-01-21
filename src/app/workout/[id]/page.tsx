'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Activity, Clock, Gauge, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import ActiveSession from '@/components/workout/ActiveSession'
import { createClient } from '@/lib/supabase/client'
import { normalizePlanInput } from '@/lib/generator'
import { createWorkoutSession } from '@/lib/session-creation'
import { fetchTemplateHistory } from '@/lib/session-history'
import { promptForSessionMinutes } from '@/lib/session-time'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { calculateSessionImpactFromSets } from '@/lib/workout-metrics'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
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

export default function WorkoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { user } = useUser()
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingSession, setStartingSession] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishingSession, setFinishingSession] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelingSession, setCancelingSession] = useState(false)
  const startSession = useWorkoutStore((state) => state.startSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const activeSession = useWorkoutStore((state) => state.activeSession)

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
      }
      setLoading(false)
    }

    if (params.id) fetchTemplate()
  }, [params.id, supabase])

  const sessionActive = searchParams.get('session') === 'active'
  const sessionId = searchParams.get('sessionId')
  const fromParam = searchParams.get('from')
  const hasActiveSession = Boolean(activeSession)
  const isCurrentSessionActive = sessionActive || (activeSession?.templateId === template?.id)
  const activeSessionLink = activeSession?.templateId
    ? `/workout/${activeSession.templateId}?session=active&sessionId=${activeSession.id}&from=dashboard`
    : '/dashboard'

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
    const durationMinutes = promptForSessionMinutes(template.template_inputs?.time?.minutesPerSession ?? 45)
    if (!durationMinutes) return
    setStartError(null)
    setStartingSession(true)

    try {
      const normalizedInputs = normalizePlanInput(template.template_inputs ?? {})
      const history = await fetchTemplateHistory(supabase, template.id)
      const nameSuffix = `${toMuscleLabel(template.focus)} ${template.style.replace('_', ' ')}`
      const { sessionId: createdSessionId, startedAt, sessionName, exercises, impact, timezone, sessionNotes } =
        await createWorkoutSession({
          supabase,
          userId: user.id,
          templateId: template.id,
          templateTitle: template.title,
          focus: template.focus,
          goal: template.style,
          input: normalizedInputs,
          minutesAvailable: durationMinutes,
          history,
          nameSuffix
        })

      startSession({
        id: createdSessionId,
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

      const fromQuery = fromParam ? `&from=${fromParam}` : ''
      router.push(`/workout/${template.id}?session=active&sessionId=${createdSessionId}${fromQuery}`)
    } catch (error) {
      console.error('Failed to start session', error)
      setStartError('Unable to start the session. Please try again.')
    } finally {
      setStartingSession(false)
    }
  }

  const handleFinishSession = async () => {
    const currentSessionId = activeSession?.id ?? sessionId
    if (!currentSessionId) return
    if (!confirm('Are you sure you want to finish this workout?')) return
    setFinishError(null)
    setFinishingSession(true)
    try {
      const endedAt = new Date().toISOString()
      const recalculatedImpact = activeSession
        ? calculateSessionImpactFromSets(activeSession, endedAt)
        : null
      const sessionUpdate = {
        ended_at: endedAt,
        status: 'completed',
        ...(recalculatedImpact
          ? { impact: recalculatedImpact }
          : activeSession?.impact
            ? { impact: activeSession.impact }
            : {})
      }
      const { error } = await supabase
        .from('sessions')
        .update(sessionUpdate)
        .eq('id', currentSessionId)

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

  const handleCancelSession = async () => {
    const currentSessionId = activeSession?.id ?? sessionId
    if (!currentSessionId) return
    if (!confirm('Cancel this session and discard any logged sets?')) return
    setCancelError(null)
    setCancelingSession(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          status: 'cancelled',
          ended_at: new Date().toISOString()
        })
        .eq('id', currentSessionId)

      if (error) throw error
      endSession()
      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to cancel workout:', error)
      setCancelError('Failed to cancel workout. Please try again.')
    } finally {
      setCancelingSession(false)
    }
  }

  if (loading) return <div className="page-shell p-10 text-center text-muted">Loading template...</div>
  if (!template) return <div className="page-shell p-10 text-center text-muted">Template not found.</div>

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href="/dashboard" className="transition-colors hover:text-strong">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-subtle">{template.title}</span>
            </div>
            <h1 className="text-3xl font-semibold text-strong">{template.title}</h1>
            {template.description && <p className="text-muted">{template.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {sessionActive && (activeSession || sessionId) && <ActiveSession sessionId={sessionId} />}

            {!sessionActive && (
              <Card className="p-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold text-strong">Template overview</h2>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Exercises will be generated when you start a session and enter your available time.
                </p>
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
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-strong">Session controls</h2>
              </div>
              {startError && <div className="mt-3 alert-error px-3 py-2 text-xs">{startError}</div>}
              {finishError && <div className="mt-3 alert-error px-3 py-2 text-xs">{finishError}</div>}
              {cancelError && <div className="mt-3 alert-error px-3 py-2 text-xs">{cancelError}</div>}

              <div className="mt-4 space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleStartSession}
                  disabled={startingSession || hasActiveSession}
                  className="w-full justify-center"
                >
                  {hasActiveSession
                    ? 'Session Active'
                    : startingSession
                      ? 'Starting...'
                      : 'Start Session'}
                </Button>
                {isCurrentSessionActive && (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleFinishSession}
                      disabled={finishingSession}
                      className="w-full justify-center"
                    >
                      {finishingSession ? 'Finishing...' : 'Finish Session'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCancelSession}
                      disabled={cancelingSession}
                      className="w-full justify-center text-red-500 hover:text-red-600"
                    >
                      {cancelingSession ? 'Cancelling...' : 'Cancel Session'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-strong">Next steps</h2>
              </div>
              <p className="mt-2 text-sm text-muted">
                Start a session to generate a customized exercise list. Each session uses your focus, equipment,
                intensity, and available time to keep workouts fresh.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
