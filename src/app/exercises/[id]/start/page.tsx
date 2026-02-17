'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Clock, AlertTriangle, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { normalizePlanInput } from '@/lib/generator'
import { createWorkoutSession } from '@/lib/session-creation'
import { fetchTemplateHistory } from '@/lib/session-history'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { 
  computeReadinessScore, 
  getReadinessIntensity, 
  getReadinessLevel, 
  type ReadinessSurvey 
} from '@/lib/training-metrics'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { FocusArea, Goal, SessionGoal, PlanInput, Exercise, CardioActivity } from '@/types/domain'
import { ReadinessCheck, READINESS_FIELDS } from '@/components/workout/start/ReadinessCheck'
import { SessionPreview } from '@/components/workout/start/SessionPreview'
import { mapCatalogRowToExercise } from '@/lib/generator/mappers'
import { CARDIO_ACTIVITY_OPTIONS } from '@/lib/cardio-activities'
import { isExerciseEquipmentAvailable } from '@/lib/equipment'
import { Checkbox } from '@/components/ui/Checkbox'

type WorkoutTemplate = {
  id: string
  title: string
  description: string | null
  focus: FocusArea
  style: Goal
  experience_level: PlanInput['experienceLevel']
  intensity: PlanInput['intensity']
  template_inputs: PlanInput | null
  created_at: string
}

type SessionIntensitySetting = {
  value: number
  label: string
  intensity: PlanInput['intensity']
  experienceDelta: -1 | 0 | 1
  restPreference: PlanInput['preferences']['restPreference']
  helper: string
}

type ReadinessSurveyDraft = {
  [Key in keyof ReadinessSurvey]: number | null
}

const EXPERIENCE_LEVELS: PlanInput['experienceLevel'][] = ['beginner', 'intermediate', 'advanced']

const SESSION_INTENSITY_LEVELS: SessionIntensitySetting[] = [
  { value: 1, label: 'Ease in', intensity: 'low', experienceDelta: -1, restPreference: 'high_recovery', helper: 'Lower intensity with extra recovery.' },
  { value: 2, label: 'Steady', intensity: 'moderate', experienceDelta: 0, restPreference: 'balanced', helper: 'Balanced intensity and rest.' },
  { value: 3, label: 'Push', intensity: 'high', experienceDelta: 1, restPreference: 'minimal_rest', helper: 'Higher intensity with shorter rest.' }
]

const STYLE_OPTIONS: { value: Goal; label: string; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Power focus, low reps, high rest.' },
  { value: 'hypertrophy', label: 'Hypertrophy', description: 'Growth focus, moderate reps, moderate rest.' },
  { value: 'endurance', label: 'Endurance', description: 'Conditioning focus, high reps, low rest.' }
]

const shiftExperienceLevel = (base: PlanInput['experienceLevel'], delta: -1 | 0 | 1) => {
  const index = EXPERIENCE_LEVELS.indexOf(base)
  if (index === -1) return base
  const nextIndex = Math.max(0, Math.min(EXPERIENCE_LEVELS.length - 1, index + delta))
  return EXPERIENCE_LEVELS[nextIndex]
}

function LegacyWorkoutStartPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const { user } = useUser()
  const startSession = useWorkoutStore((state) => state.startSession)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingSession, setStartingSession] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  
  const queryMinutes = searchParams.get('minutes')
  const queryStyle = searchParams.get('style') as Goal | null
  const queryWeight = searchParams.get('weight')

  const [minutesAvailable, setMinutesAvailable] = useState(queryMinutes ? parseInt(queryMinutes) : 45)
  const [overrideStyle, setOverrideStyle] = useState<Goal | null>(queryStyle)
  const [bodyWeightLb] = useState<number | undefined>(queryWeight ? parseFloat(queryWeight) : undefined)

  const [catalog, setCatalog] = useState<Exercise[]>([])
  const [readinessSurvey, setReadinessSurvey] = useState<ReadinessSurveyDraft>({
    sleep: null, soreness: null, stress: null, motivation: null
  })
  const [selectedCardioActivities, setSelectedCardioActivities] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      const [templateRes, catalogRes] = await Promise.all([
        supabase.from('workout_templates').select(`
          id, title, description, focus, style, experience_level,
          intensity, template_inputs, created_at
        `).eq('id', params.id).single(),
        supabase.from('exercise_catalog').select(`
          id, name, category, focus, movement_pattern, metric_profile,
          primary_muscle, secondary_muscles, equipment,
          e1rm_eligible, is_interval, or_group
        `)
      ])
      
      if (!templateRes.error) {
        setTemplate(templateRes.data)
        if (!queryMinutes) {
          setMinutesAvailable(templateRes.data?.template_inputs?.time?.minutesPerSession ?? 45)
        }
        if (!queryStyle) {
          setOverrideStyle(templateRes.data?.style)
        }
      }
      if (!catalogRes.error && catalogRes.data) {
        setCatalog(catalogRes.data.map(mapCatalogRowToExercise))
      }
      setLoading(false)
    }
    if (params.id) init()
  }, [params.id, supabase, queryMinutes, queryStyle])

  const availableCardioOptions = useMemo(() => {
    if (!template || template.focus !== 'cardio') return []
    const inventory = template.template_inputs?.equipment?.inventory
    if (!inventory) return CARDIO_ACTIVITY_OPTIONS

    return CARDIO_ACTIVITY_OPTIONS.filter(option => {
      const matchingExercises = catalog.filter(ex => 
        ex.category === 'Cardio' && 
        option.keywords.some(k => ex.name.toLowerCase().includes(k.toLowerCase()))
      )
      return matchingExercises.some(ex => isExerciseEquipmentAvailable(inventory, ex.equipment))
    })
  }, [template, catalog])

  const readinessComplete = useMemo(() => READINESS_FIELDS.every((f) => typeof readinessSurvey[f.key] === 'number'), [readinessSurvey])
  const readinessScore = useMemo(() => (readinessComplete ? computeReadinessScore(readinessSurvey as ReadinessSurvey) : null), [readinessComplete, readinessSurvey])
  const readinessLevel = useMemo(() => (typeof readinessScore === 'number' ? getReadinessLevel(readinessScore) : null), [readinessScore])

  const selectedIntensity = useMemo(() => {
    const baseIntensity = template?.template_inputs?.intensity ?? template?.intensity ?? 'moderate'
    const intensityKey = readinessLevel ? getReadinessIntensity(readinessLevel) : baseIntensity
    return SESSION_INTENSITY_LEVELS.find((o) => o.intensity === intensityKey) ?? SESSION_INTENSITY_LEVELS[1]
  }, [template, readinessLevel])

  const handleStartSession = async (force = false) => {
    if (!template || !user || !readinessComplete || readinessScore === null || !readinessLevel) return
    if (activeSession && !force) { setShowConflictModal(true); return }
    setStartingSession(true)
    try {
      if (force && activeSession?.id) {
        await supabase.from('sessions').update({ status: 'cancelled', ended_at: new Date().toISOString() }).eq('id', activeSession.id)
        endSession()
      }
      const baseInput = normalizePlanInput(template.template_inputs ?? {})
      const tunedInputs: PlanInput = { 
        ...baseInput, 
        intensity: selectedIntensity.intensity, 
        experienceLevel: shiftExperienceLevel(baseInput.experienceLevel ?? template.experience_level ?? 'intermediate', selectedIntensity.experienceDelta), 
        preferences: { 
          ...baseInput.preferences, 
          restPreference: selectedIntensity.restPreference,
          cardioActivities: template.focus === 'cardio' ? (selectedCardioActivities as CardioActivity[]) : baseInput.preferences.cardioActivities
        } 
      }
      const history = await fetchTemplateHistory(supabase, template.id)
      
      const sessionGoal: SessionGoal =
        template.focus === 'mobility'
          ? 'range_of_motion'
          : template.focus === 'cardio'
            ? 'cardio'
            : overrideStyle ?? template.style
      const generatorGoal: Goal = overrideStyle ?? template.style
      
      const { sessionId, startedAt, sessionName, exercises, impact, timezone, sessionNotes } = await createWorkoutSession({
        supabase, 
        userId: user.id, 
        templateId: template.id, 
        templateTitle: buildWorkoutDisplayName({ 
          focus: template.focus, 
          style: sessionGoal, 
          intensity: selectedIntensity.intensity, 
          fallback: template.title 
        }),
        focus: template.focus, 
        goal: generatorGoal, 
        sessionGoal,
        input: tunedInputs, 
        minutesAvailable, 
        readiness: { 
          survey: readinessSurvey as ReadinessSurvey, 
          score: readinessScore, 
          level: readinessLevel 
        },
        sessionNotes: { 
          sessionIntensity: selectedIntensity.intensity, 
          minutesAvailable, 
          readiness: readinessLevel, 
          readinessScore, 
          readinessSurvey: readinessSurvey as ReadinessSurvey, 
          source: 'workout_start',
          goal: sessionGoal,
          focus: template.focus,
          equipmentInventory: tunedInputs.equipment?.inventory ?? null
        },
        history, 
        nameSuffix: '',
        catalog,
        bodyWeightLb: bodyWeightLb
      })
      
      startSession({ 
        id: sessionId, 
        userId: user.id, 
        templateId: template.id, 
        name: sessionName, 
        sessionFocus: template.focus,
        sessionGoal: sessionGoal,
        sessionIntensity: selectedIntensity.intensity,
        startedAt, 
        status: 'in_progress', 
        impact, 
        exercises, 
        timezone, 
        sessionNotes,
        bodyWeightLb: bodyWeightLb ?? null
      })
      router.push(`/exercises/${template.id}/active?sessionId=${sessionId}&from=start`)
    } catch (err) { 
      console.error(err)
      setStartError('Unable to start the session.') 
    } finally { 
      setStartingSession(false) 
    }
  }

  if (loading) return <div className="page-shell p-10 text-center text-muted font-medium">Loading session setup...</div>
  if (!template) return <div className="page-shell p-10 text-center text-muted">Template not found.</div>

  const activeSessionLink = activeSession?.templateId 
    ? `/exercises/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=exercises` 
    : '/dashboard'

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold text-strong">
              Start {buildWorkoutDisplayName({ 
                focus: template.focus, 
                style: overrideStyle ?? template.style, 
                intensity: template.intensity, 
                fallback: template.title 
              })}
            </h1>
            {template.description && <p className="text-sm text-muted">{template.description}</p>}
          </div>
        </div>

        {startError && <div className="alert-error p-4 text-sm mb-6">{startError}</div>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-strong">Session settings</h2>
              </div>
              
              <div className="space-y-8">
                {/* Style Selector - Option B implementation */}
                {template.focus !== 'mobility' && template.focus !== 'cardio' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-subtle" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-subtle">Session Intent</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setOverrideStyle(opt.value)}
                          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                            overrideStyle === opt.value 
                              ? 'border-accent bg-accent/5 ring-1 ring-accent' 
                              : 'border-[var(--color-border)] hover:border-strong'
                          }`}
                        >
                          <span className={`text-sm font-bold ${overrideStyle === opt.value ? 'text-accent' : 'text-strong'}`}>
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-muted leading-tight mt-1">{opt.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time Selector */}
                <div>
                  <div className="flex items-center justify-between text-xs text-subtle font-bold uppercase tracking-wider mb-3">
                    <span>Minutes available</span>
                    <span className="text-accent">{minutesAvailable} min</span>
                  </div>
                  <input 
                    type="range" 
                    min={20} 
                    max={120} 
                    step={5} 
                    value={minutesAvailable} 
                    onChange={(e) => setMinutesAvailable(Number(e.target.value))} 
                    className="w-full accent-accent" 
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[30, 45, 60, 90].map((v) => (
                      <Button 
                        key={v} 
                        size="sm" 
                        variant={minutesAvailable === v ? 'primary' : 'secondary'} 
                        onClick={() => setMinutesAvailable(v)}
                        className="min-w-[60px]"
                      >
                        {v}m
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Cardio Selection */}
                {template.focus === 'cardio' && availableCardioOptions.length > 0 && (
                  <div className="surface-card-muted p-5 rounded-xl border border-[var(--color-border)]">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-strong mb-4">Choose cardio activities</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availableCardioOptions.map((option) => (
                        <Checkbox
                          key={option.value}
                          label={option.label}
                          checked={selectedCardioActivities.includes(option.value)}
                          onCheckedChange={() => {
                            setSelectedCardioActivities(prev => 
                              prev.includes(option.value) 
                                ? prev.filter(v => v !== option.value) 
                                : [...prev, option.value]
                            )
                          }}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-subtle italic">Leave blank to include any activity matching your equipment.</p>
                  </div>
                )}

                {/* Readiness Check */}
                <ReadinessCheck 
                  survey={readinessSurvey} 
                  onUpdateField={(f, v) => setReadinessSurvey(p => ({ ...p, [f]: v }))} 
                  score={readinessScore} 
                  level={readinessLevel} 
                />
              </div>
            </Card>

            <SessionPreview 
              focus={template.focus} 
              style={overrideStyle ?? template.style} 
              intensityLabel={readinessLevel ? selectedIntensity.label : 'Pending readiness'} 
              equipmentInventory={template.template_inputs?.equipment?.inventory} 
            />
          </div>

          <div className="space-y-4">
            <Card className="p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-strong">Ready to train?</h2>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                We will adapt this session to your {minutesAvailable}m time limit, {readinessLevel || 'current'} readiness, and chosen style.
              </p>
              
              <Button 
                type="button" 
                onClick={() => handleStartSession()} 
                disabled={startingSession || !readinessComplete} 
                className="mt-6 w-full justify-center py-6 text-lg"
              >
                {startingSession ? 'Preparing...' : 'Start Session'}
              </Button>
              
              {activeSession && (
                <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20 text-center">
                  <p className="text-xs font-bold text-accent uppercase tracking-wider">Session in progress</p>
                </div>
              )}
              
              <div className="mt-6 space-y-3 pt-6 border-t border-[var(--color-border)]">
                <div className="flex justify-between text-xs">
                  <span className="text-subtle">Readiness</span>
                  <span className={`font-bold capitalize ${
                    readinessLevel === 'high' ? 'text-green-500' : 
                    readinessLevel === 'steady' ? 'text-accent' : 
                    'text-amber-500'
                  }`}>
                    {readinessLevel || 'Incomplete'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-subtle">Intensity</span>
                  <span className="text-strong font-bold">{selectedIntensity.label}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {showConflictModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="surface-elevated w-full max-w-md p-6 shadow-2xl border border-[var(--color-border-strong)] rounded-2xl">
            <div className="flex items-center gap-3 text-[var(--color-warning)] mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-xl font-bold text-strong">Session in Progress</h3>
            </div>
            <p className="text-sm text-muted mb-6">
              You already have an active workout session. Would you like to continue it, or cancel it and start this new one?
            </p>
            <div className="space-y-3">
              <Button className="w-full justify-center py-6" onClick={() => router.push(activeSessionLink)}>
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
              <Button variant="secondary" className="w-full justify-center" onClick={() => setShowConflictModal(false)}>
                Go Back
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExerciseStartRedirectPage() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    if (!params.id) return
    const templateId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!templateId) return
    router.replace(`/workout/${templateId}?start=1`)
  }, [params.id, router])

  return <div className="page-shell p-10 text-center text-muted">Redirecting to session setup…</div>
}
