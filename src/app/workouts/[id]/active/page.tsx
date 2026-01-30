'use client'

import { Suspense, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import ActiveSession from '@/components/workout/ActiveSession'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { formatFocusLabel, formatGoalLabel } from '@/lib/workout-metrics'
import { completeSession } from '@/lib/session-completion'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import type { SessionGoal } from '@/types/domain'

type ConfirmAction = {
  type: 'finish' | 'cancel'
  title: string
  description: string
  confirmText: string
  variant: 'danger' | 'info' | 'warning'
}

function WorkoutActiveContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const { catalog } = useExerciseCatalog()
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishingSession, setFinishingSession] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const bodyWeightRef = useRef<number | null>(null)

  const sessionId = searchParams.get('sessionId')
  const currentSessionId = activeSession?.id ?? sessionId
  const sessionNotes = activeSession?.sessionNotes
    ? (typeof activeSession.sessionNotes === 'string' ? JSON.parse(activeSession.sessionNotes) : activeSession.sessionNotes)
    : null
  const sessionGoal = (activeSession?.sessionGoal ?? sessionNotes?.goal ?? null) as SessionGoal | null
  const sessionFocus = activeSession?.sessionFocus ?? sessionNotes?.focus ?? null
  const equipmentInventory = sessionNotes?.equipmentInventory ?? null
  const sessionTitle = activeSession?.name ?? 'Active session'

  const requestFinish = () => {
    setConfirmAction({
      type: 'finish',
      title: 'Finish Workout',
      description: 'Are you sure you want to finish this workout? Make sure you have logged all your sets.',
      confirmText: 'Finish',
      variant: 'info'
    })
  }

  const requestCancel = () => {
    setConfirmAction({
      type: 'cancel',
      title: 'Cancel Workout',
      description: 'Are you sure you want to cancel this session? Any progress will be discarded.',
      confirmText: 'Cancel Session',
      variant: 'danger'
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    if (confirmAction.type === 'finish') await executeFinish()
    if (confirmAction.type === 'cancel') await executeCancel()
    setConfirmAction(null)
  }

  const executeFinish = async () => {
    if (!currentSessionId || !activeSession || !user?.id) return
    setFinishError(null)
    setFinishingSession(true)
    try {
      const result = await completeSession({
        supabase,
        sessionId: currentSessionId,
        session: activeSession,
        userId: user.id,
        bodyWeightLb: bodyWeightRef.current,
        sessionGoal,
        equipmentInventory,
        exerciseCatalog: catalog.map((e) => ({ name: e.name, e1rmEligible: e.e1rmEligible }))
      })

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to complete session')
      }

      endSession()
      router.push(`/workouts/${params.id}/summary?sessionId=${currentSessionId}`)
    } catch (error) {
      console.error('Failed to finish workout:', error)
      setFinishError('Failed to finish workout. Please try again.')
    } finally {
      setFinishingSession(false)
    }
  }

  const executeCancel = async () => {
    if (!currentSessionId) return
    setCancelError(null)
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
            {sessionGoal && sessionFocus && (
              <p className="text-sm text-muted">
                {formatGoalLabel(sessionGoal)} focus · {formatFocusLabel(sessionFocus)}
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
              equipmentInventory={equipmentInventory}
              onBodyWeightChange={(weight) => (bodyWeightRef.current = weight)}
              onFinish={requestFinish}
              onCancel={requestCancel}
              isFinishing={finishingSession}
              focus={sessionFocus}
              style={sessionGoal}
            />
          </div>

          <div className="space-y-4">
            {(finishError || cancelError) && (
              <Card className="p-4 border-[var(--color-danger)] bg-[var(--color-danger-soft)]/10">
                {finishError && <div className="text-xs text-[var(--color-danger)] font-medium">{finishError}</div>}
                {cancelError && <div className="mt-2 text-xs text-[var(--color-danger)] font-medium">{cancelError}</div>}
              </Card>
            )}

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong">Focus cues</h2>
              <p className="mt-2 text-sm text-muted">
                Stay present. Log each set with intent and let the smart targets guide your next move.
              </p>
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
        isLoading={finishingSession}
      />
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
