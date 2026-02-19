'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Home } from 'lucide-react'
import { ActiveSession } from '@/components/workout/ActiveSession'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ValidationBlockerModal } from '@/components/ui/ValidationBlockerModal'
import { useSupabase } from '@/hooks/useSupabase'
import { completeSession } from '@/lib/session-completion'
import { validateSessionForCompletion, type SetValidationError } from '@/lib/session-validation'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import type { SessionGoal } from '@/types/domain'

type ConfirmAction = {
  type: 'finish'
  title: string
  description: string
  confirmText: string
  variant: 'danger' | 'info' | 'warning'
}

function WorkoutActiveContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabase()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const { catalog } = useExerciseCatalog()
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishingSession, setFinishingSession] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [validationErrors, setValidationErrors] = useState<SetValidationError[]>([])
  const [showValidationBlocker, setShowValidationBlocker] = useState(false)
  const [hasNoCompletedSets, setHasNoCompletedSets] = useState(false)

  const sessionId = searchParams.get('sessionId')
  const currentSessionId = activeSession?.id ?? sessionId
  const sessionNotes = activeSession?.sessionNotes
    ? (typeof activeSession.sessionNotes === 'string' ? JSON.parse(activeSession.sessionNotes) : activeSession.sessionNotes)
    : null
  const sessionGoal = (activeSession?.sessionGoal ?? sessionNotes?.goal ?? null) as SessionGoal | null
  const sessionFocus = activeSession?.sessionFocus ?? sessionNotes?.focus ?? null
  const equipmentInventory = sessionNotes?.equipmentInventory ?? null

  const requestFinish = () => {
    // Validate session before showing finish confirmation
    const validation = validateSessionForCompletion(activeSession)
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      setHasNoCompletedSets(validation.hasNoCompletedSets)
      setShowValidationBlocker(true)
      return
    }
    
    setConfirmAction({
      type: 'finish',
      title: 'Finish Workout',
      description: 'Are you sure you want to finish this workout? Make sure you have logged all your sets.',
      confirmText: 'Finish',
      variant: 'info'
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    if (confirmAction.type === 'finish') await executeFinish()
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
        bodyWeightLb: activeSession.bodyWeightLb ?? null,
        sessionGoal,
        equipmentInventory,
        exerciseCatalog: catalog.map((e) => ({ name: e.name, e1rmEligible: e.e1rmEligible }))
      })

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to complete session')
      }

      endSession()
      if (params.id) {
        router.push(`/exercises/${params.id}/summary?sessionId=${currentSessionId}`)
      } else {
        router.push(`/exercises/summary?sessionId=${currentSessionId}`)
      }
    } catch (error) {
      console.error('Failed to finish workout:', error)
      setFinishError('Failed to finish workout. Please try again.')
    } finally {
      setFinishingSession(false)
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
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Link href="/dashboard" className="transition-colors hover:text-strong">
              Workouts
            </Link>
            <span>/</span>
            <span className="text-subtle">Active</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <Home className="h-4 w-4" /> Go to Dashboard
          </Button>
        </div>

        {finishError && (
          <div className="mb-4 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)]/10 p-3 text-xs text-[var(--color-danger)] font-medium">
            {finishError}
          </div>
        )}

        <ActiveSession
          sessionId={currentSessionId}
          equipmentInventory={equipmentInventory}
          onFinish={requestFinish}
          isFinishing={finishingSession}
          focus={activeSession?.sessionFocusAreas ?? sessionFocus}
          style={sessionGoal}
        />
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

      <ValidationBlockerModal
        isOpen={showValidationBlocker}
        onClose={() => setShowValidationBlocker(false)}
        errors={validationErrors}
        hasNoCompletedSets={hasNoCompletedSets}
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
