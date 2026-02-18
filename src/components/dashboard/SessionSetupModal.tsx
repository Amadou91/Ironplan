'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Dumbbell, Scale, X, Play, AlertTriangle, Loader2, Heart, Zap, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cloneInventory, equipmentPresets, bodyweightOnlyInventory } from '@/lib/equipment'
import { createClient } from '@/lib/supabase/client'
import { normalizePlanInput } from '@/lib/generator'
import { normalizePreferences } from '@/lib/preferences'
import {
  getPrimaryFocusArea,
  formatFocusAreasLabel,
  resolveSessionFocusAreas,
  resolveArmFocusTargets,
  toggleSessionFocusSelection,
  SESSION_FOCUS_SELECTION_OPTIONS,
  SESSION_ARM_FOCUS_OPTIONS,
  type ArmFocusArea
} from '@/lib/session-focus'
import { createWorkoutSession } from '@/lib/session-creation'
import { fetchTemplateHistory } from '@/lib/session-history'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { 
  computeReadinessScore, 
  getReadinessIntensity, 
  getReadinessLevel,
  type ReadinessSurvey,
  type ReadinessLevel
} from '@/lib/training-metrics'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import type { Exercise, FocusArea, Goal, PlanInput, SessionGoal } from '@/types/domain'

export interface SessionSetupModalProps {
  isOpen: boolean
  onClose: () => void
  templateId?: string
  templateTitle?: string
  templateFocus?: FocusArea
  templateStyle?: Goal
  initialFocusAreas?: FocusArea[]
  templateIntensity?: PlanInput['intensity']
  templateInputs?: PlanInput | null
  templateExperienceLevel?: PlanInput['experienceLevel']
}

type ReadinessSurveyDraft = {
  [Key in keyof ReadinessSurvey]: number | null
}

type SessionIntensitySetting = {
  value: number
  label: string
  intensity: PlanInput['intensity']
  experienceDelta: -1 | 0 | 1
  restPreference: PlanInput['preferences']['restPreference']
  helper: string
}

const TRAINING_STYLES: { label: string; value: Goal; description: string }[] = [
  { label: 'Strength', value: 'strength', description: 'Power focus, low reps' },
  { label: 'Hypertrophy', value: 'hypertrophy', description: 'Growth focus, moderate reps' },
  { label: 'Endurance', value: 'endurance', description: 'Conditioning, high reps' }
]

const READINESS_FIELDS: Array<{
  key: keyof ReadinessSurvey
  label: string
  helper: string
}> = [
  { key: 'sleep', label: 'Sleep', helper: '1 = poor, 5 = great' },
  { key: 'soreness', label: 'Soreness', helper: '1 = fresh, 5 = very sore' },
  { key: 'stress', label: 'Stress', helper: '1 = calm, 5 = high' },
  { key: 'motivation', label: 'Motivation', helper: '1 = low, 5 = high' }
]

const SESSION_INTENSITY_LEVELS: SessionIntensitySetting[] = [
  { value: 1, label: 'Ease in', intensity: 'low', experienceDelta: -1, restPreference: 'high_recovery', helper: 'Lower intensity with extra recovery.' },
  { value: 2, label: 'Steady', intensity: 'moderate', experienceDelta: 0, restPreference: 'balanced', helper: 'Balanced intensity and rest.' },
  { value: 3, label: 'Push', intensity: 'high', experienceDelta: 1, restPreference: 'minimal_rest', helper: 'Higher intensity with shorter rest.' }
]

const EXPERIENCE_LEVELS: PlanInput['experienceLevel'][] = ['beginner', 'intermediate', 'advanced']

const FOCUS_AREA_COLORS: Record<string, { active: string; inactive: string }> = {
  chest:     { active: 'bg-red-500/10 border-red-400/50 text-red-600 dark:text-red-400',     inactive: 'border-[var(--color-border)] text-muted hover:bg-red-500/5 hover:border-red-400/30 hover:text-red-600 dark:hover:text-red-400' },
  back:      { active: 'bg-red-500/10 border-red-400/50 text-red-600 dark:text-red-400',     inactive: 'border-[var(--color-border)] text-muted hover:bg-red-500/5 hover:border-red-400/30 hover:text-red-600 dark:hover:text-red-400' },
  shoulders: { active: 'bg-red-500/10 border-red-400/50 text-red-600 dark:text-red-400',     inactive: 'border-[var(--color-border)] text-muted hover:bg-red-500/5 hover:border-red-400/30 hover:text-red-600 dark:hover:text-red-400' },
  arms:      { active: 'bg-red-500/10 border-red-400/50 text-red-600 dark:text-red-400',     inactive: 'border-[var(--color-border)] text-muted hover:bg-red-500/5 hover:border-red-400/30 hover:text-red-600 dark:hover:text-red-400' },
  legs:      { active: 'bg-red-500/10 border-red-400/50 text-red-600 dark:text-red-400',     inactive: 'border-[var(--color-border)] text-muted hover:bg-red-500/5 hover:border-red-400/30 hover:text-red-600 dark:hover:text-red-400' },
  core:      { active: 'bg-red-500/10 border-red-400/50 text-red-600 dark:text-red-400',     inactive: 'border-[var(--color-border)] text-muted hover:bg-red-500/5 hover:border-red-400/30 hover:text-red-600 dark:hover:text-red-400' },
  cardio:    { active: 'bg-emerald-500/10 border-emerald-400/50 text-emerald-700 dark:text-emerald-400', inactive: 'border-[var(--color-border)] text-muted hover:bg-emerald-500/5 hover:border-emerald-400/30 hover:text-emerald-700 dark:hover:text-emerald-400' },
  mobility:  { active: 'bg-purple-500/10 border-purple-400/50 text-purple-700 dark:text-purple-400', inactive: 'border-[var(--color-border)] text-muted hover:bg-purple-500/5 hover:border-purple-400/30 hover:text-purple-700 dark:hover:text-purple-400' },
}

const shiftExperienceLevel = (base: PlanInput['experienceLevel'], delta: -1 | 0 | 1) => {
  const index = EXPERIENCE_LEVELS.indexOf(base)
  if (index === -1) return base
  const nextIndex = Math.max(0, Math.min(EXPERIENCE_LEVELS.length - 1, index + delta))
  return EXPERIENCE_LEVELS[nextIndex]
}

export function SessionSetupModal({ 
  isOpen, 
  onClose, 
  templateId,
  templateTitle,
  templateFocus,
  templateStyle,
  initialFocusAreas,
  templateIntensity,
  templateInputs,
  templateExperienceLevel
}: SessionSetupModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const { user } = useUser()
  const startSession = useWorkoutStore((state) => state.startSession)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)

  const defaultFocusAreas = useMemo(
    () => resolveSessionFocusAreas(templateFocus ? [templateFocus] : initialFocusAreas, 'chest'),
    [initialFocusAreas, templateFocus]
  )
  const [minutes, setMinutes] = useState(templateInputs?.time?.minutesPerSession ?? 45)
  const [style, setStyle] = useState<Goal>(templateStyle ?? 'hypertrophy')
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(defaultFocusAreas)
  const [armFocusTargets, setArmFocusTargets] = useState<ArmFocusArea[]>([])
  const [equipmentInventory, setEquipmentInventory] = useState(
    cloneInventory(templateInputs?.equipment?.inventory ?? equipmentPresets.custom)
  )
  const [bodyWeight, setBodyWeight] = useState<string>('')
  const [readinessSurvey, setReadinessSurvey] = useState<ReadinessSurveyDraft>({
    sleep: null, soreness: null, stress: null, motivation: null
  })
  const { catalog, loading: catalogLoading } = useExerciseCatalog()
  const [startingSession, setStartingSession] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelingSession, setCancelingSession] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMinutes(templateInputs?.time?.minutesPerSession ?? 45)
      setStyle(templateStyle ?? 'hypertrophy')
      setFocusAreas(defaultFocusAreas)
      setArmFocusTargets(defaultFocusAreas.filter((focus): focus is ArmFocusArea => focus === 'biceps' || focus === 'triceps'))
      setEquipmentInventory(cloneInventory(templateInputs?.equipment?.inventory ?? equipmentPresets.custom))
      setBodyWeight('')
      setReadinessSurvey({ sleep: null, soreness: null, stress: null, motivation: null })
      setStartError(null)
      setShowConflictModal(false)
    }
  }, [defaultFocusAreas, isOpen, templateStyle, templateInputs])

  useEffect(() => {
    if (!isOpen || !user) return

    const loadProfileEquipment = async () => {
      if (templateInputs?.equipment?.inventory) return
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()

      const normalizedPreferences = normalizePreferences(data?.preferences)
      if (normalizedPreferences.equipment?.inventory) {
        setEquipmentInventory(cloneInventory(normalizedPreferences.equipment.inventory))
      } else {
        // No equipment configured in profile: default to bodyweight-only so
        // the generator always produces a non-empty exercise list.
        setEquipmentInventory(bodyweightOnlyInventory())
      }
    }

    loadProfileEquipment()
  }, [isOpen, supabase, templateInputs?.equipment?.inventory, user])

  const readinessComplete = useMemo(() => 
    READINESS_FIELDS.every((f) => typeof readinessSurvey[f.key] === 'number'), 
    [readinessSurvey]
  )
  
  const readinessScore = useMemo(() => 
    readinessComplete ? computeReadinessScore(readinessSurvey as ReadinessSurvey) : null, 
    [readinessComplete, readinessSurvey]
  )
  
  const readinessLevel = useMemo(() => 
    typeof readinessScore === 'number' ? getReadinessLevel(readinessScore) : null, 
    [readinessScore]
  )

  const selectedIntensity = useMemo(() => {
    const baseIntensity = templateIntensity ?? 'moderate'
    const intensityKey = readinessLevel ? getReadinessIntensity(readinessLevel) : baseIntensity
    return SESSION_INTENSITY_LEVELS.find((o) => o.intensity === intensityKey) ?? SESSION_INTENSITY_LEVELS[1]
  }, [templateIntensity, readinessLevel])

  const allFocusesAreMobility = focusAreas.length > 0 && focusAreas.every((focus) => focus === 'mobility')
  const allFocusesAreCardio = focusAreas.length > 0 && focusAreas.every((focus) => focus === 'cardio')
  const showStyleSelector = !allFocusesAreMobility && !allFocusesAreCardio
  const hasArmsFocus = focusAreas.includes('arms')
  const displayedFocusAreas = resolveArmFocusTargets(focusAreas, armFocusTargets)

  const handleStartSession = async (force = false) => {
    if (!user || !readinessComplete || readinessScore === null || !readinessLevel) return
    const normalizedFocusAreas = resolveSessionFocusAreas(focusAreas, templateFocus ?? 'chest')
    const expandedFocusAreas = resolveArmFocusTargets(normalizedFocusAreas, armFocusTargets)
    if (!normalizedFocusAreas.length) {
      setStartError('Select at least one focus area to start your session.')
      return
    }
    if (activeSession && !force) { 
      setShowConflictModal(true)
      return 
    }
    
    setStartingSession(true)
    setStartError(null)
    
    try {
      if (force && activeSession?.id) {
        await supabase.from('sessions').update({ 
          status: 'cancelled', 
          ended_at: new Date().toISOString() 
        }).eq('id', activeSession.id)
        endSession()
      }

      const baseInput = normalizePlanInput(templateInputs ?? {})
      const tunedInputs: PlanInput = { 
        ...baseInput, 
        equipment: {
          ...baseInput.equipment,
          preset: 'custom',
          inventory: equipmentInventory
        },
        intensity: selectedIntensity.intensity, 
        experienceLevel: shiftExperienceLevel(
          baseInput.experienceLevel ?? templateExperienceLevel ?? 'intermediate', 
          selectedIntensity.experienceDelta
        ), 
        preferences: { 
          ...baseInput.preferences, 
          restPreference: selectedIntensity.restPreference
        } 
      }
      
      const history = templateId ? await fetchTemplateHistory(supabase, templateId) : undefined

      const sessionPrimaryFocus = getPrimaryFocusArea(expandedFocusAreas, templateFocus ?? 'chest')
      
      const sessionGoal: SessionGoal =
        allFocusesAreMobility
          ? 'range_of_motion'
          : allFocusesAreCardio
            ? 'cardio'
            : style
      const generatorGoal: Goal = allFocusesAreCardio ? 'cardio' : allFocusesAreMobility ? 'range_of_motion' : style

      const resolvedTitle = templateTitle ??
        buildWorkoutDisplayName({
          focus: sessionPrimaryFocus,
          focusAreas: expandedFocusAreas,
          style: sessionGoal,
          intensity: selectedIntensity.intensity,
          fallback: 'Quick Session'
        })

      const bodyWeightLb = bodyWeight ? parseFloat(bodyWeight) : undefined

      const { sessionId, startedAt, sessionName, exercises, impact, timezone, sessionNotes } = 
        await createWorkoutSession({
          supabase, 
          userId: user.id, 
          templateId, 
          templateTitle: buildWorkoutDisplayName({ 
            focus: sessionPrimaryFocus,
            focusAreas: expandedFocusAreas,
            style: sessionGoal, 
            intensity: selectedIntensity.intensity, 
            fallback: resolvedTitle
          }),
          focusAreas: expandedFocusAreas,
          goal: generatorGoal, 
          sessionGoal,
          input: tunedInputs, 
          minutesAvailable: minutes, 
          readiness: { 
            survey: readinessSurvey as ReadinessSurvey, 
            score: readinessScore, 
            level: readinessLevel as ReadinessLevel
          },
          sessionNotes: { 
            sessionIntensity: selectedIntensity.intensity, 
            minutesAvailable: minutes, 
            readiness: readinessLevel, 
            readinessScore, 
            readinessSurvey: readinessSurvey as ReadinessSurvey, 
            source: 'session_setup_modal',
            goal: sessionGoal,
            focus: sessionPrimaryFocus,
            focusAreas: expandedFocusAreas,
            equipmentInventory: tunedInputs.equipment?.inventory ?? null
          },
          history, 
          nameSuffix: '',
          catalog,
          bodyWeightLb
        })
      
      startSession({ 
        id: sessionId, 
        userId: user.id, 
        templateId: templateId ?? undefined,
        name: sessionName, 
        sessionFocus: sessionPrimaryFocus,
        sessionFocusAreas: expandedFocusAreas,
        sessionGoal,
        sessionIntensity: selectedIntensity.intensity,
        startedAt, 
        status: 'in_progress', 
        impact, 
        exercises, 
        timezone, 
        sessionNotes,
        bodyWeightLb: bodyWeightLb ?? null
      })
      
      onClose()
      if (templateId) {
        router.push(`/exercises/${templateId}/active?sessionId=${sessionId}&from=start`)
      } else {
        router.push(`/exercises/active?sessionId=${sessionId}&from=start`)
      }
    } catch (err) { 
      console.error(err)
      setStartError('Unable to start the session. Please try again.') 
    } finally { 
      setStartingSession(false) 
    }
  }

  const handleUpdateReadinessField = (field: keyof ReadinessSurvey, value: number) => {
    setReadinessSurvey(prev => ({ ...prev, [field]: value }))
  }

  const handleCancelActiveSession = async () => {
    if (!activeSession?.id) return
    setCancelingSession(true)
    try {
      await supabase.from('sessions').update({ 
        status: 'cancelled', 
        ended_at: new Date().toISOString() 
      }).eq('id', activeSession.id)
      endSession()
      setShowCancelConfirm(false)
    } catch (err) {
      console.error('Failed to cancel session:', err)
    } finally {
      setCancelingSession(false)
    }
  }

  // Determine the focus label for non-selectable workout types
  const getAutoFocusLabel = () => {
    if (allFocusesAreCardio) return 'Cardio'
    if (allFocusesAreMobility) return 'Mobility'
    return formatFocusAreasLabel(displayedFocusAreas, (focus) => {
      const sessionFocusOption = SESSION_FOCUS_SELECTION_OPTIONS.find((option) => option.value === focus)
      if (sessionFocusOption) return sessionFocusOption.label
      const armFocusOption = SESSION_ARM_FOCUS_OPTIONS.find((option) => option.value === focus)
      return armFocusOption?.label ?? focus
    })
  }
  const autoFocusLabel = getAutoFocusLabel()

  if (!isOpen) return null

  const activeSessionLink = activeSession?.templateId
    ? `/exercises/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=exercises`
    : activeSession?.id
      ? `/exercises/active?sessionId=${activeSession.id}&from=exercises`
      : '/dashboard'

  // Show conflict modal if active session
  if (showConflictModal && activeSession) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border-strong)] p-6">
          <div className="flex items-center gap-3 text-[var(--color-warning)] mb-4">
            <AlertTriangle size={24} />
            <h3 className="text-xl font-bold text-strong">Session in Progress</h3>
          </div>
          <p className="text-sm text-muted mb-6">
            You already have an active workout session. Would you like to continue it, or cancel it and start this new one?
          </p>
          <div className="space-y-3">
            <Button 
              className="w-full justify-center py-5" 
              onClick={() => {
                onClose()
                router.push(activeSessionLink)
              }}
            >
              Continue Current Session
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-center text-[var(--color-danger)]" 
              onClick={() => handleStartSession(true)} 
              disabled={startingSession}
            >
              {startingSession ? 'Starting...' : 'Cancel & Start New'}
            </Button>
            <Button 
              variant="secondary" 
              className="w-full justify-center" 
              onClick={() => setShowConflictModal(false)}
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[var(--color-surface)] rounded-3xl shadow-2xl border border-[var(--color-border-strong)] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex-shrink-0">
          <button 
            onClick={onClose}
            disabled={startingSession}
            className="absolute top-4 right-4 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] rounded-xl transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-2xl shadow-sm">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-strong uppercase tracking-tight">Start Session</h2>
              <p className="text-sm text-muted font-medium">{templateTitle ?? 'Quick Start Session'}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {startError && (
            <div className="p-3 rounded-xl bg-[var(--color-danger-soft)] border border-[var(--color-danger-border)] text-sm text-[var(--color-danger)]">
              {startError}
            </div>
          )}

          {/* Time Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">
                <Clock className="w-3.5 h-3.5" /> Time Available
              </Label>
              <span className="text-base font-black text-[var(--color-primary)]">{minutes} min</span>
            </div>
            <input 
              type="range" 
              min={20} 
              max={120} 
              step={5} 
              value={minutes} 
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={startingSession}
              className="w-full h-2 bg-[var(--color-surface-muted)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
            />
            <div className="flex justify-between gap-2">
              {[30, 45, 60, 90].map((v) => (
                <button
                  key={v}
                  onClick={() => setMinutes(v)}
                  disabled={startingSession}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                    minutes === v 
                      ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)]' 
                      : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  {v}m
                </button>
              ))}
            </div>
          </div>

          {/* Focus Areas */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">
              <Target className="w-3.5 h-3.5" /> Focus Areas
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SESSION_FOCUS_SELECTION_OPTIONS.map((option) => {
                const checked = focusAreas.includes(option.value)
                const colors = FOCUS_AREA_COLORS[option.value]
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={startingSession}
                    aria-pressed={checked}
                    onClick={() => {
                      setFocusAreas((previous) => {
                        const next = toggleSessionFocusSelection(previous, option.value)
                        if (!next.length) return previous
                        return next
                      })
                      if (option.value === 'arms' && focusAreas.includes('arms')) {
                        setArmFocusTargets([])
                      }
                    }}
                    className={`rounded-lg border px-3 py-2.5 text-xs font-bold text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      checked ? colors.active : colors.inactive
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {hasArmsFocus && (
              <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-subtle">Arms target (optional)</p>
                <div className="grid grid-cols-2 gap-2">
                  {SESSION_ARM_FOCUS_OPTIONS.map((option) => {
                    const selected = armFocusTargets.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setArmFocusTargets((previous) =>
                            previous.includes(option.value)
                              ? previous.filter((value) => value !== option.value)
                              : [...previous, option.value]
                          )
                        }}
                        disabled={startingSession}
                        className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                          selected
                            ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)]'
                            : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-subtle">Choose biceps, triceps, or both. Leave empty for general arms work.</p>
              </div>
            )}
            <p className="text-[11px] text-subtle">
              Cardio and Yoga / Mobility are exclusive modes. Select either one of them or combine strength focus areas.
            </p>
          </div>

          {/* Training Style - only show for strength-based workouts */}
          {showStyleSelector ? (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">
                <Dumbbell className="w-3.5 h-3.5" /> Training Style
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {TRAINING_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    disabled={startingSession}
                    className={`py-3 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                      style === s.value 
                        ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)] shadow-sm' 
                        : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Show auto-set focus for cardio/mobility workouts */
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">
                {allFocusesAreCardio ? <Heart className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />} Session Focus
              </Label>
              <div className="p-3 rounded-xl bg-[var(--color-primary-soft)] border border-[var(--color-primary-border)] text-center">
                <span className="text-sm font-bold text-[var(--color-primary-strong)]">
                  {autoFocusLabel}
                </span>
                <p className="text-[10px] text-muted mt-1">Automatically set based on workout type</p>
              </div>
            </div>
          )}

          {/* Readiness Survey */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">
                Readiness Check
              </Label>
              <span className={`text-xs font-bold ${
                readinessLevel === 'high' ? 'text-green-500' : 
                readinessLevel === 'steady' ? 'text-[var(--color-primary)]' : 
                readinessLevel === 'low' ? 'text-amber-500' :
                'text-muted'
              }`}>
                {readinessLevel ? `${readinessScore}/100 · ${readinessLevel}` : 'Rate all metrics'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {READINESS_FIELDS.map((field) => (
                <div 
                  key={field.key} 
                  className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-subtle)]"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-subtle mb-2">
                    <span className="font-bold">{field.label}</span>
                    <span className="text-strong">{readinessSurvey[field.key] ?? '–'}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={`${field.key}-${value}`}
                        type="button"
                        disabled={startingSession}
                        onClick={() => handleUpdateReadinessField(field.key, value)}
                        className={`h-7 rounded text-xs font-bold transition-all ${
                          readinessSurvey[field.key] === value 
                            ? 'bg-[var(--color-primary)] text-white' 
                            : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-muted hover:bg-[var(--color-surface-muted)]'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Body Weight */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">
              <Scale className="w-3.5 h-3.5" /> Current Weight (Optional)
            </Label>
            <div className="relative">
              <Input 
                type="number"
                inputMode="decimal"
                placeholder="e.g. 185" 
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                disabled={startingSession}
                className="pl-4 pr-10 h-11 font-bold text-base rounded-xl"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--color-text-muted)]">lb</span>
            </div>
          </div>

          {/* Session Preview */}
          {readinessLevel && (
            <div className="p-3 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Duration</span>
                <span className="text-strong font-bold">{minutes} min</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Focus</span>
                <span className="text-strong font-bold">
                  {autoFocusLabel ?? (style === 'strength' ? 'Strength' : style === 'hypertrophy' ? 'Hypertrophy' : 'Endurance')}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Intensity</span>
                <span className="text-strong font-bold">{selectedIntensity.label}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Readiness</span>
                <span className={`font-bold capitalize ${
                  readinessLevel === 'high' ? 'text-green-500' : 
                  readinessLevel === 'steady' ? 'text-[var(--color-primary)]' : 
                  'text-amber-500'
                }`}>
                  {readinessLevel}
                </span>
              </div>
            </div>
          )}

          {/* Active Session Warning with Cancel Option */}
          {activeSession && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-bold">Active Session</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                You have an active workout: <strong>{activeSession.name}</strong>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose()
                    router.push(activeSessionLink)
                  }}
                  className="flex-1 text-xs"
                >
                  Resume
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                >
                  Cancel Session
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--color-surface-subtle)] border-t border-[var(--color-border)] flex gap-3 flex-shrink-0">
          <Button 
            variant="ghost" 
            onClick={onClose}
            disabled={startingSession}
            className="flex-1 h-12 rounded-xl font-bold text-[var(--color-text-muted)]"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => handleStartSession()}
            disabled={startingSession || !readinessComplete || catalogLoading || focusAreas.length === 0}
            className="flex-[2] h-12 rounded-xl font-black uppercase tracking-wider shadow-lg shadow-[var(--color-primary-soft)]"
          >
            {startingSession ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2 fill-current" />
                Start Session
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Cancel Active Session Confirmation */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelActiveSession}
        title="Cancel Active Session?"
        description={`Are you sure you want to cancel your current workout "${activeSession?.name ?? 'Untitled'}"? This action cannot be undone and all unsaved progress will be lost.`}
        confirmText="Cancel Session"
        cancelText="Keep Session"
        variant="danger"
        isLoading={cancelingSession}
      />
    </div>
  )
}
