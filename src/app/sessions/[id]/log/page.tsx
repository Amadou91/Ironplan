'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { ActiveSession } from '@/components/workout/ActiveSession'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
  type: 'save' | 'discard'
  title: string
  description: string
  confirmText: string
  variant: 'danger' | 'info' | 'warning'
}

function SessionLogContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabase()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const { catalog } = useExerciseCatalog()
  
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingSession, setSavingSession] = useState(false)
  const [discardError, setDiscardError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [validationErrors, setValidationErrors] = useState<SetValidationError[]>([])
  const [showValidationBlocker, setShowValidationBlocker] = useState(false)
  const [hasNoCompletedSets, setHasNoCompletedSets] = useState(false)
  
  // Duration from the previous page (passed via query param) - now editable
  const queryDuration = searchParams.get('duration')
  const [durationMinutes] = useState(queryDuration ? parseInt(queryDuration) : 45)
  
  // Editable start time (initialized from query param, which comes from the setup page)
  const queryStartTime = searchParams.get('startTime')
  const [startTimeOverride, setStartTimeOverride] = useState<string | null>(queryStartTime ? decodeURIComponent(queryStartTime) : null)
  
  const sessionId = params?.id as string
  const currentSessionId = activeSession?.id ?? sessionId
  
  const sessionNotes = activeSession?.sessionNotes
    ? (typeof activeSession.sessionNotes === 'string' ? JSON.parse(activeSession.sessionNotes) : activeSession.sessionNotes)
    : null
  const sessionGoal = (activeSession?.sessionGoal ?? sessionNotes?.goal ?? null) as SessionGoal | null
  const sessionFocus = activeSession?.sessionFocus ?? sessionNotes?.focus ?? null
  const equipmentInventory = sessionNotes?.equipmentInventory ?? null
  const sessionTitle = activeSession?.name ?? 'Log Past Workout'
  
  const requestSave = () => {
    // Validate session before showing save confirmation
    const validation = validateSessionForCompletion(activeSession)
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      setHasNoCompletedSets(validation.hasNoCompletedSets)
      setShowValidationBlocker(true)
      return
    }
    
    setConfirmAction({
      type: 'save',
      title: 'Save Workout',
      description: 'Save this workout to your history? Make sure all sets are logged correctly.',
      confirmText: 'Save',
      variant: 'info'
    })
  }
  
  const requestDiscard = () => {
    setConfirmAction({
      type: 'discard',
      title: 'Discard Workout',
      description: 'Are you sure you want to discard this workout? All entered data will be lost.',
      confirmText: 'Discard',
      variant: 'danger'
    })
  }
  
  const handleConfirmAction = async () => {
    if (!confirmAction) return
    if (confirmAction.type === 'save') await executeSave()
    if (confirmAction.type === 'discard') await executeDiscard()
    setConfirmAction(null)
  }
  
  const executeSave = async () => {
    if (!currentSessionId || !activeSession || !user?.id) return
    setSaveError(null)
    setSavingSession(true)
    
    try {
      // Calculate end time based on start time + duration
      // Use overridden start time if user edited it
      const baseStartTime = startTimeOverride 
        ? new Date(startTimeOverride).getTime()
        : new Date(activeSession.startedAt).getTime()
      const endedAt = new Date(baseStartTime + durationMinutes * 60 * 1000).toISOString()
      const startedAtFinal = startTimeOverride ?? activeSession.startedAt
      
      // Create a modified session with the end time for the snapshot
      const sessionWithEnd = {
        ...activeSession,
        startedAt: startedAtFinal,
        endedAt
      }
      
      const result = await completeSession({
        supabase,
        sessionId: currentSessionId,
        session: sessionWithEnd,
        userId: user.id,
        bodyWeightLb: activeSession.bodyWeightLb ?? null,
        sessionGoal,
        equipmentInventory,
        exerciseCatalog: catalog.map((e) => ({ name: e.name, e1rmEligible: e.e1rmEligible })),
        endedAtOverride: endedAt
      })
      
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to save workout')
      }
      
      endSession()
      router.push('/progress')
    } catch (error) {
      console.error('Failed to save workout:', error)
      setSaveError('Failed to save workout. Please try again.')
    } finally {
      setSavingSession(false)
    }
  }
  
  const executeDiscard = async () => {
    if (!currentSessionId) return
    setDiscardError(null)
    
    try {
      // Delete the session entirely since it was never completed
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', currentSessionId)
      
      if (error) throw error
      endSession()
      router.push('/progress')
    } catch (error) {
      console.error('Failed to discard workout:', error)
      setDiscardError('Failed to discard workout. Please try again.')
    }
  }
  
  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to log a workout.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }
  
  if (!currentSessionId) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Session not found.</p>
        <Button onClick={() => router.push('/sessions/log')}>Start new log</Button>
      </div>
    )
  }
  
  return (
    <div className="page-shell">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href="/progress" className="transition-colors hover:text-strong">
                Progress
              </Link>
              <span>/</span>
              <span className="text-subtle">Log Past Workout</span>
            </div>
            <h1 className="font-display text-2xl font-semibold text-strong">{sessionTitle}</h1>
            <p className="text-sm text-muted">
              Add exercises and log your sets from this past workout.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={requestDiscard}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Discard
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_1fr)_320px]">
          <div>
            <ActiveSession
              sessionId={currentSessionId}
              equipmentInventory={equipmentInventory}
              onFinish={requestSave}
              onCancel={requestDiscard}
              isFinishing={savingSession}
              focus={activeSession?.sessionFocusAreas ?? sessionFocus}
              style={sessionGoal}
              onStartTimeChange={setStartTimeOverride}
            />
          </div>
          
          <div className="space-y-4">
            {/* Save Controls */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Save className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-strong">Save Workout</h2>
              </div>
              
              {saveError && (
                <div className="mb-4 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)]/10 p-3 text-xs text-[var(--color-danger)]">
                  {saveError}
                </div>
              )}
              {discardError && (
                <div className="mb-4 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)]/10 p-3 text-xs text-[var(--color-danger)]">
                  {discardError}
                </div>
              )}
              
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestSave}
                  disabled={savingSession}
                  className="w-full justify-center"
                >
                  {savingSession ? 'Saving...' : 'Save to History'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={requestDiscard}
                  className="w-full justify-center text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                >
                  Discard Workout
                </Button>
              </div>
            </Card>
            
            {/* Tips */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong">Tips</h2>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                <li>• Click &quot;Add Exercise&quot; to search for exercises</li>
                <li>• Enter reps, weight, and RPE for each set</li>
                <li>• Mark sets complete as you log them</li>
                <li>• Click &quot;Started at&quot; to adjust the start time</li>
              </ul>
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
        isLoading={savingSession}
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

export default function SessionLogPage() {
  return (
    <Suspense fallback={<div className="page-shell p-10 text-center text-muted">Loading...</div>}>
      <SessionLogContent />
    </Suspense>
  )
}
