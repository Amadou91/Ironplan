'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { buildWorkoutTemplate, normalizePlanInput } from '@/lib/generator'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { cloneInventory, equipmentPresets } from '@/lib/equipment'
import { applyPreferencesToPlanInput, normalizePreferences } from '@/lib/preferences'
import {
  buildWorkoutHistoryEntry,
  loadWorkoutHistory,
  removeWorkoutHistoryEntry,
  saveWorkoutHistoryEntry,
  setWorkoutHistoryEntries
} from '@/lib/workoutHistory'
import type { WorkoutHistoryEntry } from '@/lib/workoutHistory'
import { logEvent } from '@/lib/logger'
import type { FocusArea, Goal, PlanInput, WorkoutTemplateDraft } from '@/types/domain'

const buildCardioInventory = (
  inventory: PlanInput['equipment']['inventory']
): PlanInput['equipment']['inventory'] => ({
  bodyweight: inventory.bodyweight,
  dumbbells: [],
  kettlebells: [],
  bands: [],
  barbell: { available: false, plates: [] },
  machines: {
    cable: false,
    leg_press: false,
    treadmill: true,
    rower: true,
    indoor_bicycle: true,
    outdoor_bicycle: true
  }
})

const buildWorkoutTitle = (template: WorkoutTemplateDraft) =>
  buildWorkoutDisplayName({
    focus: template.focus,
    style: template.style,
    intensity: template.inputs.intensity,
    fallback: template.title
  })

export function useGenerationFlow() {
  const router = useRouter()
  const { user } = useUser()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSummary, setSaveSummary] = useState<{
    templateId?: string
    title?: string
  } | null>(null)
  const [lastSavedTemplate, setLastSavedTemplate] = useState<{
    templateId: string
    title: string
    focus: FocusArea
    style: Goal
    input: PlanInput
  } | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyEntries, setHistoryEntries] = useState<ReturnType<typeof loadWorkoutHistory>>([])
  const [deletingHistoryIds, setDeletingHistoryIds] = useState<Record<string, boolean>>({})
  const [startSessionError, setStartSessionError] = useState<string | null>(null)
  const [startingSessionKey, setStartingSessionKey] = useState<string | null>(null)
  const [preferencesApplied, setPreferencesApplied] = useState(false)
  const [hasUserEdits, setHasUserEdits] = useState(false)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const lastStrengthInventoryRef = useRef<PlanInput['equipment']['inventory'] | null>(null)
  const lastStrengthPresetRef = useRef<PlanInput['equipment']['preset'] | null>(null)

  const [formData, setFormData] = useState<PlanInput>(() =>
    normalizePlanInput({
      intent: { mode: 'body_part', style: 'strength', bodyParts: ['chest'] },
      goals: { primary: 'strength', priority: 'primary' },
      experienceLevel: 'intermediate',
      intensity: 'moderate',
      equipment: { preset: 'full_gym', inventory: cloneInventory(equipmentPresets.full_gym) },
      time: { minutesPerSession: 45 },
      schedule: {
        daysAvailable: [0],
        minRestDays: 1,
        weeklyLayout: [{ sessionIndex: 0, style: 'strength', focus: 'chest' }]
      },
      preferences: {
        focusAreas: ['chest'],
        dislikedActivities: [],
        accessibilityConstraints: [],
        restPreference: 'balanced'
      }
    })
  )

  const clearFeedback = () => {
    if (errors.length > 0) setErrors([])
    if (saveError) setSaveError(null)
    if (saveSummary) setSaveSummary(null)
    if (historyError) setHistoryError(null)
    if (startSessionError) setStartSessionError(null)
  }

  const updateFormData = (updater: (prev: PlanInput) => PlanInput) => {
    setFormData((prev) => updater(prev))
    setHasUserEdits(true)
    clearFeedback()
  }

  const handleFocusChange = (focus: FocusArea) => {
    updateFormData((prev) => {
      let targetStyle: Goal = prev.goals.primary
      if (focus === 'mobility') targetStyle = 'range_of_motion'
      else if (focus === 'cardio') targetStyle = 'endurance'
      else if (['endurance', 'range_of_motion', 'general_fitness'].includes(prev.goals.primary)) {
        // Reset to strength if moving away from special modes, unless the user explicitly wants endurance strength
        // But for simplicity, let's default to strength when switching to a muscle part, 
        // unless the previous style was strictly tied to the previous focus.
        // If previous was 'range_of_motion' (Mobility), we probably want 'strength' or keep it?
        // Usually switching to 'chest' implies Strength.
        targetStyle = 'strength'
      }

      const isCardio = focus === 'cardio'
      const isMobility = focus === 'mobility'
      const wasCardio = prev.intent.bodyParts?.[0] === 'cardio'
      const wasMobility = prev.intent.bodyParts?.[0] === 'mobility'

      if ((isCardio || isMobility) && !wasCardio && !wasMobility) {
        lastStrengthInventoryRef.current = cloneInventory(prev.equipment.inventory)
        lastStrengthPresetRef.current = prev.equipment.preset
      }

      const nextInventory = isCardio
        ? buildCardioInventory(prev.equipment.inventory)
        : isMobility
          ? { ...prev.equipment.inventory, bodyweight: true }
          : (wasCardio || wasMobility) && !isCardio && !isMobility
            ? cloneInventory(lastStrengthInventoryRef.current ?? equipmentPresets.full_gym)
            : prev.equipment.inventory

      const nextPreset = isCardio || isMobility
        ? 'custom'
        : (wasCardio || wasMobility) && !isCardio && !isMobility
          ? lastStrengthPresetRef.current ?? 'full_gym'
          : prev.equipment.preset

      const nextFocus = focus // We keep focus as 'cardio'/'mobility' if selected

      return {
        ...prev,
        intent: {
          ...prev.intent,
          mode: isCardio || isMobility ? 'style' : 'body_part',
          style: isCardio || isMobility ? targetStyle : undefined,
          bodyParts: [nextFocus]
        },
        goals: {
          ...prev.goals,
          primary: targetStyle
        },
        equipment: {
          ...prev.equipment,
          preset: nextPreset,
          inventory: nextInventory
        },
        preferences: {
          ...prev.preferences,
          focusAreas: [nextFocus]
        },
        schedule: {
          ...prev.schedule,
          weeklyLayout: [{ sessionIndex: 0, style: targetStyle, focus: nextFocus }]
        }
      }
    })
  }

  const updatePrimaryStyle = (style: Goal) => {
    updateFormData((prev) => {
      // Style change shouldn't trigger Cardio/Mobility mode unless implied?
      // But we removed Cardio/Mobility from Goal. 
      // So changing style to 'endurance' doesn't necessarily mean Cardio mode (could be high rep strength).
      // We rely on Focus for mode.
      const currentFocus = prev.intent.bodyParts?.[0]
      
      return {
        ...prev,
        intent: {
          ...prev.intent,
          style,
        },
        goals: {
          ...prev.goals,
          primary: style
        },
        schedule: {
          ...prev.schedule,
          weeklyLayout: [
            {
              sessionIndex: 0,
              style,
              focus: currentFocus ?? 'chest'
            }
          ]
        }
      }
    })
  }

  const handleHistoryLoad = (entry: WorkoutHistoryEntry) => {
    updateFormData(() => {
      const normalized = normalizePlanInput(entry.template.inputs)
      const storedFocus = normalized.intent.bodyParts?.[0] ?? entry.template.focus ?? 'chest'
      return {
        ...normalized,
        intent: {
          ...normalized.intent,
          mode: 'body_part',
          bodyParts: [storedFocus]
        },
        preferences: {
          ...normalized.preferences,
          focusAreas: [storedFocus]
        },
        schedule: {
          ...normalized.schedule,
          daysAvailable: [0],
          weeklyLayout: [{ sessionIndex: 0, style: normalized.goals.primary, focus: storedFocus }]
        }
      }
    })
  }

  const handleHistoryDelete = async (entry: WorkoutHistoryEntry) => {
    const entryTitle = buildWorkoutDisplayName({
      focus: entry.template.focus,
      style: entry.template.style,
      intensity: entry.template.inputs.intensity,
      fallback: entry.title
    })
    if (!confirm(`Delete "${entryTitle}" from your saved templates? This cannot be undone.`)) return
    if (!user) return
    setHistoryError(null)
    setDeletingHistoryIds((prev) => ({ ...prev, [entry.id]: true }))

    try {
      if (entry.remoteId) {
        const { error } = await supabase
          .from('workout_templates')
          .delete()
          .eq('id', entry.remoteId)
          .eq('user_id', user.id)

        if (error) {
          console.error('Failed to delete workout history entry from server', error)
          setHistoryError('Removed locally, but unable to delete the saved workout on the server.')
        }
      }
    } catch (error) {
      console.error('Failed to delete workout history entry', error)
      setHistoryError('Removed locally, but unable to delete the saved workout on the server.')
    } finally {
      if (typeof window !== 'undefined') {
        removeWorkoutHistoryEntry(entry.id, window.localStorage)
      }
      setHistoryEntries((prev) => prev.filter((item) => item.id !== entry.id))
      setDeletingHistoryIds((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  const handleStartSession = ({ templateId, sessionKey }: { templateId: string; sessionKey: string }) => {
    if (!user) return
    if (activeSession) {
      setStartSessionError('Finish your current session before starting a new one.')
      if (activeSession.templateId && activeSession.id) {
        router.push(`/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=generate`)
      } else if (activeSession.id) {
        router.push(`/workouts/active?sessionId=${activeSession.id}&from=generate`)
      }
      return
    }
    setStartSessionError(null)
    setStartingSessionKey(sessionKey)
    router.push(`/workouts/${templateId}/start`)
  }

  const generatePlanHandler = async () => {
    if (!user) return
    setLoading(true)
    setSaveError(null)

    const { template, errors: validationErrors } = buildWorkoutTemplate(formData)
    if (validationErrors.length > 0 || !template) {
      setErrors(validationErrors)
      logEvent('warn', 'plan_validation_failed', { errors: validationErrors })
      setLoading(false)
      return
    }

    setErrors([])
    setSaveSummary(null)
    logEvent('info', 'plan_generated', {
      userId: user.id,
      focus: template.focus,
      style: template.style,
      experienceLevel: template.inputs.experienceLevel,
      intensity: template.inputs.intensity,
      equipment: template.inputs.equipment
    })

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      const authUser = authData?.user
      if (authError || !authUser) {
        setSaveError('Your session has expired. Please sign in again.')
        setLoading(false)
        return
      }

      const displayTitle = buildWorkoutTitle(template)
      const newTemplate = {
        user_id: authUser.id,
        title: displayTitle,
        description: template.description,
        focus: template.focus,
        style: template.style,
        experience_level: template.inputs.experienceLevel,
        intensity: template.inputs.intensity,
        equipment: template.inputs.equipment,
        preferences: template.inputs.preferences,
        template_inputs: template.inputs
      }

      const { data, error } = await supabase.from('workout_templates').insert([newTemplate]).select().single()

      if (error) {
        setSaveError(`Failed to save template: ${error.message}`)
        setLoading(false)
        return
      }

      if (typeof window !== 'undefined') {
        try {
          const entry = buildWorkoutHistoryEntry(template, data.id)
          const titledEntry = { ...entry, title: displayTitle }
          saveWorkoutHistoryEntry(titledEntry, window.localStorage)
          setHistoryEntries((prev) => [titledEntry, ...prev.filter((item) => item.id !== titledEntry.id)])
        } catch (error) {
          console.error('Failed to store workout history', error)
          setHistoryError('Unable to save workout history locally.')
        }
      }

      setSaveSummary({
        templateId: data.id,
        title: displayTitle
      })
      setLastSavedTemplate({
        templateId: data.id,
        title: displayTitle,
        focus: template.focus,
        style: template.style,
        input: template.inputs
      })
    } catch (err) {
      console.error('Failed to save template', err)
      setSaveError('Failed to save template. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const history = loadWorkoutHistory(window.localStorage)
      setHistoryEntries(history)
    } catch (error) {
      console.error('Failed to load history', error)
      setHistoryError('Unable to load workout history.')
    }
  }, [])

  useEffect(() => {
    if (!user || preferencesApplied || hasUserEdits) return
    let isMounted = true
    const loadPreferences = async () => {
      const { data, error } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle()
      if (error) {
        if (isMounted) setPreferencesApplied(true)
        return
      }
      const normalized = normalizePreferences(data?.preferences)
      if (isMounted) {
        setFormData((prev) => applyPreferencesToPlanInput(prev, normalized))
        setPreferencesApplied(true)
      }
    }
    loadPreferences()
    return () => {
      isMounted = false
    }
  }, [hasUserEdits, preferencesApplied, supabase, user])

  useEffect(() => {
    if (!user || typeof window === 'undefined') return
    const syncHistory = async () => {
      const { data, error } = await supabase.from('workout_templates').select('id').eq('user_id', user.id)
      if (error) return
      const existingIds = new Set((data ?? []).map((row) => row.id))
      setHistoryEntries((prev) => {
        const next = prev.filter((entry) => !entry.remoteId || existingIds.has(entry.remoteId))
        if (next.length !== prev.length) {
          setWorkoutHistoryEntries(next, window.localStorage)
        }
        return next
      })
    }
    syncHistory()
  }, [supabase, user])

  return {
    formData,
    loading,
    errors,
    saveError,
    saveSummary,
    lastSavedTemplate,
    historyError,
    historyEntries,
    deletingHistoryIds,
    startSessionError,
    startingSessionKey,
    updateFormData,
    handleFocusChange,
    handleHistoryLoad,
    handleHistoryDelete,
    handleStartSession,
    generatePlanHandler
  }
}
