import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeSession } from '@/lib/session-completion'
import { validateSessionForCompletion, type SetValidationError } from '@/lib/session-validation'
import { useSupabase } from '@/hooks/useSupabase'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useUser } from '@/hooks/useUser'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import type { SessionGoal, EquipmentInventory } from '@/types/domain'

export type ConfirmAction = {
  type: 'save' | 'discard' | 'cancel'
  title: string
  description: string
  confirmText: string
  variant: 'danger' | 'info' | 'warning'
}

type UseActiveSessionFlowProps = {
  sessionId: string
  onSaveSuccess?: () => void
  onDiscard?: () => Promise<void>
  onCancel?: () => void
}

export function useActiveSessionFlow({
  sessionId,
  onSaveSuccess,
  onDiscard,
  onCancel
}: UseActiveSessionFlowProps) {
  const router = useRouter()
  const supabase = useSupabase()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const { catalog } = useExerciseCatalog()

  const [savingSession, setSavingSession] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<SetValidationError[]>([])
  const [showValidationBlocker, setShowValidationBlocker] = useState(false)
  const [hasNoCompletedSets, setHasNoCompletedSets] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

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

  const requestCancel = () => {
    setConfirmAction({
      type: 'cancel',
      title: 'Discard Changes',
      description: 'Are you sure you want to discard your changes? The original session will be preserved.',
      confirmText: 'Discard',
      variant: 'danger'
    })
  }

  const executeSave = async ({
    startTimeOverride,
    durationMinutes = 45,
    sessionGoal,
    equipmentInventory
  }: {
    startTimeOverride?: string | null
    durationMinutes?: number
    sessionGoal?: SessionGoal | null
    equipmentInventory?: EquipmentInventory | null
  }) => {
    if (!sessionId || !activeSession || !user?.id) return
    setSaveError(null)
    setSavingSession(true)

    try {
      // Calculate end time based on start time + duration
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
        sessionId,
        session: sessionWithEnd,
        userId: user.id,
        bodyWeightLb: activeSession.bodyWeightLb ?? null,
        sessionGoal,
        equipmentInventory,
        exerciseCatalog: catalog.map((e) => ({ name: e.name, e1rmEligible: e.e1rmEligible })),
        endedAtOverride: endedAt,
        startedAtOverride: startedAtFinal
      })

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to save workout')
      }

      endSession()
      if (onSaveSuccess) {
        onSaveSuccess()
      } else {
        router.push('/progress')
      }
    } catch (error) {
      console.error('Failed to save workout:', error)
      setSaveError('Failed to save workout. Please try again.')
    } finally {
      setSavingSession(false)
    }
  }

  const executeDiscard = async () => {
    if (onDiscard) {
      setSavingSession(true)
      try {
        await onDiscard()
      } catch (error) {
        console.error('Failed to discard:', error)
      } finally {
        setSavingSession(false)
      }
    } else {
      endSession()
      router.push('/progress')
    }
  }

  const executeCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      endSession()
      router.push('/progress')
    }
  }

  const resetConfirmAction = () => setConfirmAction(null)

  return {
    savingSession,
    saveError,
    validationErrors,
    showValidationBlocker,
    hasNoCompletedSets,
    confirmAction,
    setShowValidationBlocker,
    setConfirmAction,
    requestSave,
    requestDiscard,
    requestCancel,
    executeSave,
    executeDiscard,
    executeCancel,
    resetConfirmAction
  }
}
