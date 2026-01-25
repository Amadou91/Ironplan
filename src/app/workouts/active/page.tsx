'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'
import ActiveSession from '@/components/workout/ActiveSession'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { calculateSessionImpactFromSets } from '@/lib/workout-metrics'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import type { FocusArea, PlanInput } from '@/types/domain'

type WorkoutTemplate = {
  id: string
  title: string
  focus: FocusArea
  style: PlanInput['goals']['primary']
  template_inputs: PlanInput | null
}

function WorkoutActiveContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishingSession, setFinishingSession] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelingSession, setCancelingSession] = useState(false)
  const bodyWeightRef = useRef<number | null>(null)

  const sessionId = searchParams.get('sessionId')
  const currentSessionId = activeSession?.id ?? sessionId
  const sessionNotes = activeSession?.sessionNotes ? (typeof activeSession.sessionNotes === 'string' ? JSON.parse(activeSession.sessionNotes) : activeSession.sessionNotes) : null;
  const minutesAvailable = sessionNotes?.minutesAvailable;

  const sessionTitle = buildWorkoutDisplayName({
    focus: template?.focus ?? null,
    style: template?.style ?? null,
    intensity: template?.template_inputs?.intensity ?? null,
    minutes: typeof minutesAvailable === 'number' ? minutesAvailable : null,
    fallback: activeSession?.name ?? template?.title ?? 'Active session',
    cardioExerciseName: template?.style === 'cardio' && activeSession?.exercises?.[0]?.name ? activeSession.exercises[0].name : null
  })

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!params.id) return;
      const { data, error } = await supabase
        .from('workout_templates')
        .select('id, title, focus, style, template_inputs')
        .eq('id', params.id)
        .single()

      if (error) {
        console.error('Error fetching template:', error)
      } else {
        setTemplate(data)
      }
    }

    fetchTemplate()
  }, [params.id, supabase])

  const handleFinishSession = async () => {
    if (!currentSessionId) return
    if (!confirm('Are you sure you want to finish this workout?')) return
    setFinishError(null)
    setFinishingSession(true)
    try {
      const endedAt = new Date().toISOString()
      
      if (bodyWeightRef.current && user?.id) {
        await Promise.all([
          supabase.from('profiles').update({ weight_lb: bodyWeightRef.current }).eq('id', user.id),
          supabase.from('body_measurements').insert({ 
            user_id: user.id, 
            weight_lb: bodyWeightRef.current,
            recorded_at: endedAt 
          })
        ])
      }

      const recalculatedImpact = activeSession
        ? calculateSessionImpactFromSets(activeSession, endedAt)
        : null

      let finalName = activeSession?.name;
      if (template?.style === 'cardio' && activeSession?.exercises?.length) {
        const firstExName = activeSession.exercises[0].name;
        // Only append if it's not already in the name
        if (!finalName?.includes(firstExName)) {
          finalName = `Cardio ${firstExName}`;
        }
      }

      const sessionUpdate = {
        name: finalName,
        ended_at: endedAt,
        status: 'completed',
        impact: recalculatedImpact,
        body_weight_lb: bodyWeightRef.current
      }
      const { error } = await supabase
        .from('sessions')
        .update(sessionUpdate)
        .eq('id', currentSessionId)

      if (error) throw error
      endSession()
      if (params.id) {
        router.push(`/workouts/${params.id}/summary?sessionId=${currentSessionId}`)
      } else {
        router.push(`/workouts/summary?sessionId=${currentSessionId}`)
      }
    } catch (error) {
      console.error('Failed to finish workout:', error)
      setFinishError('Failed to finish workout. Please try again.')
    } finally {
      setFinishingSession(false)
    }
  }

  const handleCancelSession = async () => {
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

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to continue your session.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  if (!currentSessionId) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">We could not find this session.</p>
        <Button onClick={() => router.push('/dashboard')}>Back to workouts</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href="/dashboard" className="transition-colors hover:text-strong">
                Workouts
              </Link>
              <span>/</span>
              <span className="text-subtle">Active</span>
            </div>
            <h1 className="font-display text-2xl font-semibold text-strong">{sessionTitle}</h1>
            {template && (
              <p className="text-sm text-muted">
                {toTitleCase(template.style.replace('_', ' '))} focus · {toTitleCase(template.focus.replace('_', ' '))}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              <X className="h-4 w-4" /> Exit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_1fr)_320px]">
          <div>
            <ActiveSession
              sessionId={currentSessionId}
              equipmentInventory={template?.template_inputs?.equipment?.inventory ?? null}
              onBodyWeightChange={(weight) => (bodyWeightRef.current = weight)}
              focus={template?.focus}
              style={template?.style}
            />
          </div>

          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-strong">Session controls</h2>
              </div>
              {finishError && <div className="mt-3 alert-error px-3 py-2 text-xs">{finishError}</div>}
              {cancelError && <div className="mt-3 alert-error px-3 py-2 text-xs">{cancelError}</div>}

              <div className="mt-4 space-y-2">
                <Button
                  type="button"
                  variant="secondary"
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
                  className="w-full justify-center text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                >
                  {cancelingSession ? 'Cancelling...' : 'Cancel Session'}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong">Focus cues</h2>
              <p className="mt-2 text-sm text-muted">
                Stay present. Log each set with intent and let the smart targets guide your next move.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WorkoutActivePage() {
  return (
    <Suspense fallback={<div className="page-shell p-10 text-center text-muted">Loading session...</div>}>
      <WorkoutActiveContent />
    </Suspense>
  )
}

const toTitleCase = (value: string) =>
  value
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
