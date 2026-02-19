'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ActiveSession } from '@/components/workout/ActiveSession'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ValidationBlockerModal } from '@/components/ui/ValidationBlockerModal'
import { useSupabase } from '@/hooks/useSupabase'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useActiveSessionFlow } from '@/hooks/useActiveSessionFlow'
import type { SessionGoal } from '@/types/domain'

function SessionLogContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabase()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  
  const sessionId = params?.id as string
  const currentSessionId = activeSession?.id ?? sessionId
  
  // Duration from the previous page (passed via query param) - now editable
  const queryDuration = searchParams.get('duration')
  const [durationMinutes] = useState(queryDuration ? parseInt(queryDuration) : 45)
  
  // Editable start time (initialized from query param, which comes from the setup page)
  const queryStartTime = searchParams.get('startTime')
  const [startTimeOverride, setStartTimeOverride] = useState<string | null>(queryStartTime ? decodeURIComponent(queryStartTime) : null)
  
  const [discardError, setDiscardError] = useState<string | null>(null)

  const handleDiscardSession = async () => {
    if (!currentSessionId) return
    setDiscardError(null)
    
    try {
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
      throw error // Re-throw to let the hook know it failed
    }
  }

  const {
    savingSession,
    saveError,
    validationErrors,
    showValidationBlocker,
    hasNoCompletedSets,
    confirmAction,
    setShowValidationBlocker,
    requestSave,
    requestDiscard,
    executeSave,
    executeDiscard,
    resetConfirmAction
  } = useActiveSessionFlow({ 
    sessionId: currentSessionId,
    onSaveSuccess: () => router.push('/progress'),
    onDiscard: handleDiscardSession
  })
  
  const sessionNotes = useMemo(() => {
    if (!activeSession?.sessionNotes) return null
    try {
      return typeof activeSession.sessionNotes === 'string' 
        ? JSON.parse(activeSession.sessionNotes) 
        : activeSession.sessionNotes
    } catch {
      return null
    }
  }, [activeSession?.sessionNotes])

  const sessionGoal = (activeSession?.sessionGoal ?? sessionNotes?.goal ?? null) as SessionGoal | null
  const sessionFocus = activeSession?.sessionFocus ?? sessionNotes?.focus ?? null
  const equipmentInventory = sessionNotes?.equipmentInventory ?? null
  
  const handleConfirmAction = async () => {
    if (!confirmAction) return
    
    if (confirmAction.type === 'save') {
      await executeSave({
        startTimeOverride,
        durationMinutes,
        sessionGoal,
        equipmentInventory
      })
    } else if (confirmAction.type === 'discard') {
      await executeDiscard()
    }
    
    resetConfirmAction()
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
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Link href="/progress" className="transition-colors hover:text-strong">
              Progress
            </Link>
            <span>/</span>
            <span className="text-subtle">Log Past Workout</span>
          </div>
          <Button variant="ghost" size="sm" onClick={requestDiscard}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Discard
          </Button>
        </div>
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_1fr)_320px]">
          <div>
            <ActiveSession
              sessionId={currentSessionId}
              equipmentInventory={equipmentInventory}
              onFinish={requestSave}
              isFinishing={savingSession}
              focus={activeSession?.sessionFocusAreas ?? sessionFocus}
              style={sessionGoal}
              onStartTimeChange={setStartTimeOverride}
            />
          </div>
          
          <div className="space-y-4">
            {(saveError || discardError) && (
              <Card className="p-4 border-[var(--color-danger)] bg-[var(--color-danger-soft)]/10">
                {saveError && <div className="text-xs text-[var(--color-danger)] font-medium">{saveError}</div>}
                {discardError && <div className="mt-2 text-xs text-[var(--color-danger)] font-medium">{discardError}</div>}
              </Card>
            )}

            <Card className="p-4">
              <Button
                type="button"
                variant="ghost"
                onClick={requestDiscard}
                className="w-full justify-center text-[var(--color-danger)] hover:text-[var(--color-danger)]"
              >
                Discard Workout
              </Button>
            </Card>
          </div>
        </div>
      </div>
      
      <ConfirmDialog 
        isOpen={Boolean(confirmAction)}
        onClose={resetConfirmAction}
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