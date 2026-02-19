'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ActiveSession } from '@/components/workout/ActiveSession'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ValidationBlockerModal } from '@/components/ui/ValidationBlockerModal'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useSessionLoader } from '@/hooks/useSessionLoader'
import { useActiveSessionFlow } from '@/hooks/useActiveSessionFlow'
import type { SessionGoal } from '@/types/domain'

function SessionEditContent() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  
  const sessionId = params?.id as string
  
  // Use extracted hooks
  const { loading, loadError, durationMinutes: loadedDuration } = useSessionLoader(sessionId)
  const [startTimeOverride, setStartTimeOverride] = useState<string | null>(null)
  
  const {
    savingSession,
    saveError,
    validationErrors,
    showValidationBlocker,
    hasNoCompletedSets,
    confirmAction,
    setShowValidationBlocker,
    requestSave,
    requestCancel,
    executeSave,
    executeCancel,
    resetConfirmAction
  } = useActiveSessionFlow({ 
    sessionId,
    onSaveSuccess: () => router.push('/progress'),
    onCancel: () => {
      // Handled by executeCancel default
    }
  })
  
  // Parse session notes for equipment inventory
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
        durationMinutes: loadedDuration,
        sessionGoal,
        equipmentInventory
      })
    } else if (confirmAction.type === 'cancel') {
      executeCancel()
    }
    
    resetConfirmAction()
  }
  
  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to edit sessions.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }
  
  if (loading) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        Loading session...
      </div>
    )
  }
  
  if (loadError || !activeSession) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">{loadError ?? 'Session not found.'}</p>
        <Button onClick={() => router.push('/progress')}>Return to Progress</Button>
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
            <span className="text-subtle">Edit Session</span>
          </div>
          <Button variant="ghost" size="sm" onClick={requestCancel}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Cancel
          </Button>
        </div>
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_1fr)_320px]">
          <div>
            <ActiveSession
              sessionId={sessionId}
              equipmentInventory={equipmentInventory}
              onFinish={requestSave}
              isFinishing={savingSession}
              focus={activeSession?.sessionFocusAreas ?? sessionFocus}
              style={sessionGoal}
              onStartTimeChange={setStartTimeOverride}
            />
          </div>
          
          <div className="space-y-4">
            {saveError && (
              <Card className="p-4 border-[var(--color-danger)] bg-[var(--color-danger-soft)]/10">
                <div className="text-xs text-[var(--color-danger)] font-medium">{saveError}</div>
              </Card>
            )}

            <Card className="p-4 space-y-3">
              <Button
                type="button"
                onClick={requestSave}
                disabled={savingSession}
                className="w-full justify-center bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)] disabled:opacity-50"
              >
                {savingSession ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={requestCancel}
                className="w-full justify-center text-[var(--color-danger)] hover:text-[var(--color-danger)]"
              >
                Cancel Edit
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

export default function SessionEditPage() {
  return (
    <Suspense fallback={<div className="page-shell p-10 text-center text-muted">Loading...</div>}>
      <SessionEditContent />
    </Suspense>
  )
}