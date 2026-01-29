'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Dumbbell, Scale, X, Play, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { createClient } from '@/lib/supabase/client'
import { normalizePlanInput } from '@/lib/generator'
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
import { mapCatalogRowToExercise } from '@/lib/generator/mappers'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import type { Exercise, FocusArea, Goal, PlanInput, SessionGoal } from '@/types/domain'

export interface SessionSetupModalProps {
  isOpen: boolean
  onClose: () => void
  templateId: string
  templateTitle: string
  templateFocus: FocusArea
  templateStyle: Goal
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

  const [minutes, setMinutes] = useState(templateInputs?.time?.minutesPerSession ?? 45)
  const [style, setStyle] = useState<Goal>(templateStyle)
  const [bodyWeight, setBodyWeight] = useState<string>('')
  const [readinessSurvey, setReadinessSurvey] = useState<ReadinessSurveyDraft>({
    sleep: null, soreness: null, stress: null, motivation: null
  })
  const [catalog, setCatalog] = useState<Exercise[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [startingSession, setStartingSession] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)

  // Load exercise catalog when modal opens
  useEffect(() => {
    if (!isOpen) return
    const loadCatalog = async () => {
      const { data, error } = await supabase.from('exercise_catalog').select(`
        id, name, category, focus, movement_pattern, metric_profile,
        primary_muscle, secondary_muscles, equipment,
        e1rm_eligible, is_interval, or_group
      `)
      if (!error && data) {
        setCatalog(data.map(mapCatalogRowToExercise))
      }
      setCatalogLoaded(true)
    }
    loadCatalog()
  }, [isOpen, supabase])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMinutes(templateInputs?.time?.minutesPerSession ?? 45)
      setStyle(templateStyle)
      setBodyWeight('')
      setReadinessSurvey({ sleep: null, soreness: null, stress: null, motivation: null })
      setStartError(null)
      setShowConflictModal(false)
    }
  }, [isOpen, templateStyle, templateInputs])

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

  const showStyleSelector = templateFocus !== 'mobility' && templateFocus !== 'cardio'

  const handleStartSession = async (force = false) => {
    if (!user || !readinessComplete || readinessScore === null || !readinessLevel) return
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
      
      const history = await fetchTemplateHistory(supabase, templateId)
      
      const sessionGoal: SessionGoal =
        templateFocus === 'mobility'
          ? 'range_of_motion'
          : templateFocus === 'cardio'
            ? 'cardio'
            : style
      const generatorGoal: Goal = style

      const bodyWeightLb = bodyWeight ? parseFloat(bodyWeight) : undefined

      const { sessionId, startedAt, sessionName, exercises, impact, timezone, sessionNotes } = 
        await createWorkoutSession({
          supabase, 
          userId: user.id, 
          templateId, 
          templateTitle: buildWorkoutDisplayName({ 
            focus: templateFocus, 
            style: sessionGoal, 
            intensity: selectedIntensity.intensity, 
            fallback: templateTitle 
          }),
          focus: templateFocus, 
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
            focus: templateFocus,
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
        templateId, 
        name: sessionName, 
        sessionFocus: templateFocus,
        sessionGoal,
        sessionIntensity: selectedIntensity.intensity,
        startedAt, 
        status: 'in_progress', 
        impact, 
        exercises, 
        timezone, 
        sessionNotes 
      })
      
      onClose()
      router.push(`/workouts/${templateId}/active?sessionId=${sessionId}&from=start`)
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

  if (!isOpen) return null

  const activeSessionLink = activeSession?.templateId 
    ? `/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=workouts` 
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
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-3xl shadow-2xl border border-[var(--color-border-strong)] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
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
              <p className="text-sm text-muted font-medium">{templateTitle}</p>
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

          {/* Training Style - only show for non-mobility/cardio */}
          {showStyleSelector && (
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
            disabled={startingSession || !readinessComplete || !catalogLoaded}
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
    </div>
  )
}
