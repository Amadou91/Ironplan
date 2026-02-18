'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useSupabase } from '@/hooks/useSupabase'
import { normalizePreferences } from '@/lib/preferences'
import { convertWeight, roundWeight } from '@/lib/units'
import { enhanceExerciseData } from '@/lib/muscle-utils'
import { fetchExerciseHistory } from '@/lib/session-history'
import { sessionQueryResultSchema, safeParseSingle } from '@/lib/validation/schemas'
import { adaptPrescription } from '@/lib/generator/adaptation'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import { mapSessionPayload } from '@/lib/session-mapper'
import type { SessionPayload } from '@/lib/session-mapper'
import type { Goal, Intensity, PlanInput } from '@/types/domain'
import type { ExerciseHistoryPoint } from '@/lib/session-history'

type GeneratedExerciseTarget = {
  name?: string; sets?: number; reps?: string | number; rpe?: number; restSeconds?: number
}

const EXPERIENCE_LEVELS: PlanInput['experienceLevel'][] = ['beginner', 'intermediate', 'advanced']
const EXPERIENCE_DELTA: Record<Intensity, -1 | 0 | 1> = { low: -1, moderate: 0, high: 1 }
const shiftExperience = (base: PlanInput['experienceLevel'], delta: -1 | 0 | 1) => {
  const idx = EXPERIENCE_LEVELS.indexOf(base)
  return idx === -1 ? base : EXPERIENCE_LEVELS[Math.max(0, Math.min(2, idx + delta))]
}

/**
 * Handles fetching/initializing session data, profile, template, exercise history,
 * and computing derived values like exercise targets and the exercise library.
 */
export function useSessionData(sessionId?: string | null) {
  const { activeSession, startSession, updateSession } = useWorkoutStore()
  const supabase = useSupabase()
  const { catalog } = useExerciseCatalog()

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null)
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryPoint[]>([])
  const [sessionBodyWeight, setSessionBodyWeight] = useState<string>('')
  const [templateExpLevel, setTemplateExpLevel] = useState<PlanInput['experienceLevel'] | null>(null)

  const preferredUnit = activeSession?.weightUnit ?? 'lb'

  const exerciseLibrary = useMemo(
    () => catalog.map((ex) => enhanceExerciseData(ex)), [catalog]
  )
  const exerciseLibraryByName = useMemo(
    () => new Map(exerciseLibrary.map((ex) => [ex.name.toLowerCase(), ex])), [exerciseLibrary]
  )

  const targetExpLevel = useMemo(() => {
    const base = templateExpLevel ?? 'intermediate'
    const delta = EXPERIENCE_DELTA[(activeSession?.sessionIntensity || 'moderate') as Intensity] ?? 0
    return shiftExperience(base, delta)
  }, [activeSession?.sessionIntensity, templateExpLevel])

  const exerciseTargets = useMemo(() => {
    if (!activeSession || !exerciseLibraryByName.size) return {} as Record<string, GeneratedExerciseTarget>
    const targets: Record<string, GeneratedExerciseTarget> = {}
    const goal = (activeSession.sessionGoal || 'strength') as Goal
    const intensity = (activeSession.sessionIntensity || 'moderate') as Intensity
    activeSession.exercises.forEach(ex => {
      const match = exerciseLibraryByName.get(ex.name.toLowerCase())
      if (match) {
        const rx = adaptPrescription(match, goal, intensity, targetExpLevel, {})
        targets[ex.name.toLowerCase()] = { name: ex.name, sets: rx.sets, reps: rx.reps, rpe: rx.rpe, restSeconds: rx.restSeconds }
      }
    })
    return targets
  }, [activeSession, exerciseLibraryByName, targetExpLevel])

  // Build domain session from payload, with body-weight side effect
  const mapAndSetBodyWeight = useCallback((payload: SessionPayload) => {
    if (payload.body_weight_lb) {
      const displayWeight = preferredUnit === 'kg'
        ? roundWeight(convertWeight(payload.body_weight_lb, 'lb', 'kg'))
        : payload.body_weight_lb
      setSessionBodyWeight(String(displayWeight))
    }
    return mapSessionPayload(payload)
  }, [preferredUnit])

  // Fetch session on mount
  useEffect(() => {
    if (activeSession || !sessionId) return
    const fetch = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, user_id, name, template_id, session_focus, session_goal, session_intensity,
          started_at, ended_at, status, timezone, body_weight_lb, session_notes,
          session_focus_areas(focus_area),
          session_exercises(id, exercise_name, primary_muscle, secondary_muscles,
            metric_profile, order_index,
            sets(id, set_number, reps, weight, implement_count, load_type,
              rpe, rir, completed, performed_at, weight_unit,
              duration_seconds, distance, distance_unit, rest_seconds_actual, extras, extra_metrics))
        `).eq('id', sessionId).single()
      if (error) { setErrorMessage('Unable to load the active session.'); return }
      const validated = safeParseSingle(sessionQueryResultSchema, data, 'session fetch')
      if (!validated) { setErrorMessage('Session data format is invalid.'); return }
      if (validated.status && validated.status !== 'in_progress') { setErrorMessage('This session is no longer active.'); return }
      startSession(mapAndSetBodyWeight(validated as SessionPayload))
    }
    fetch()
  }, [activeSession, mapAndSetBodyWeight, sessionId, startSession, supabase])

  // Load template experience level
  useEffect(() => {
    if (!activeSession?.templateId) { setTemplateExpLevel(null); return }
    const load = async () => {
      const { data, error } = await supabase
        .from('workout_templates').select('experience_level, template_inputs')
        .eq('id', activeSession.templateId).maybeSingle()
      if (error || !data) return
      const inputs = data.template_inputs as Partial<PlanInput> | null
      setTemplateExpLevel(inputs?.experienceLevel ?? (data.experience_level as PlanInput['experienceLevel'] | null) ?? null)
    }
    load()
  }, [activeSession?.templateId, supabase])

  // Load profile preferences
  useEffect(() => {
    if (!activeSession?.userId) return
    const load = async () => {
      const { data } = await supabase.from('profiles').select('weight_lb, preferences')
        .eq('id', activeSession.userId).maybeSingle()
      setProfileWeightLb(data?.weight_lb ?? null)
      if (!activeSession?.weightUnit) {
        const norm = normalizePreferences(data?.preferences)
        updateSession({ weightUnit: norm.settings?.units ?? 'lb' })
      }
    }
    load()
  }, [activeSession?.userId, activeSession?.weightUnit, updateSession, supabase])

  // Load exercise history
  useEffect(() => {
    if (!activeSession?.userId) return
    fetchExerciseHistory(supabase, activeSession.userId).then(setExerciseHistory)
  }, [activeSession?.userId, supabase])

  return {
    activeSession, errorMessage, setErrorMessage,
    profileWeightLb, exerciseHistory, exerciseTargets,
    sessionBodyWeight, setSessionBodyWeight, preferredUnit,
    exerciseLibrary, exerciseLibraryByName, supabase
  }
}
