'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Target, Play, Dumbbell } from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { EquipmentSelector } from '@/components/generate/EquipmentSelector'
import { ReadinessCheck } from '@/components/workout/start/ReadinessCheck'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { cloneInventory, equipmentPresets, hasEquipment } from '@/lib/equipment'
import { normalizePreferences } from '@/lib/preferences'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import {
  computeReadinessScore,
  getReadinessIntensity,
  getReadinessLevel,
  type ReadinessSurvey
} from '@/lib/training-metrics'
import {
  getPrimaryFocusArea,
  resolveArmFocusTargets,
  resolveSessionFocusAreas,
  toggleSessionFocusSelection,
  SESSION_ARM_FOCUS_OPTIONS,
  SESSION_FOCUS_SELECTION_OPTIONS,
  type ArmFocusArea
} from '@/lib/session-focus'
import type { FocusArea, Goal, PlanInput, SessionGoal } from '@/types/domain'

type ReadinessSurveyDraft = {
  [Key in keyof ReadinessSurvey]: number | null
}

/**
 * Canonical focus options for user-selectable focus areas.
 * Must match MuscleGroupSelector for consistency.
 */
const FOCUS_OPTIONS: { value: FocusArea; label: string }[] = SESSION_FOCUS_SELECTION_OPTIONS

/**
 * Training goal options for strength-based focus areas.
 * Cardio and Mobility have fixed goals that are auto-set.
 */
const STRENGTH_GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Hypertrophy' },
  { value: 'endurance', label: 'Endurance' }
]

/**
 * Returns the appropriate goal for a focus area.
 * For cardio/mobility, returns the fixed goal. For others, returns the user's selection.
 */
const getGoalForFocus = (focusAreas: FocusArea[], userGoal: Goal): Goal => {
  const normalized = resolveSessionFocusAreas(focusAreas, 'chest')
  if (normalized.every((focus) => focus === 'mobility')) return 'range_of_motion'
  if (normalized.every((focus) => focus === 'cardio')) return 'cardio'
  return userGoal
}

/**
 * Checks if the focus area allows user to select a goal.
 */
const focusAllowsGoalSelection = (focusAreas: FocusArea[]): boolean => {
  const normalized = resolveSessionFocusAreas(focusAreas, 'chest')
  return !normalized.every((focus) => focus === 'mobility' || focus === 'cardio')
}

function formatDateForInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function LogPastWorkoutPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const { user, loading: userLoading } = useUser()
  useExerciseCatalog() // Preload catalog for downstream components
  const startSession = useWorkoutStore((state) => state.startSession)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  
  // Session setup state
  const [workoutDate, setWorkoutDate] = useState(formatDateForInput(new Date()))
  const [startTime, setStartTime] = useState('09:00')
  const [durationMinutes, setDurationMinutes] = useState('45')
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(['chest'])
  const [armFocusTargets, setArmFocusTargets] = useState<ArmFocusArea[]>([])
  const [userGoal, setUserGoal] = useState<Goal>('hypertrophy')
  const [bodyWeight, setBodyWeight] = useState('')
  const [equipment, setEquipment] = useState<PlanInput['equipment']>(() => ({
    preset: 'custom',
    inventory: cloneInventory(equipmentPresets.custom)
  }))

  const profileLoaded = useRef(false)

  // Load profile data (body weight and equipment)
  useEffect(() => {
    if (!user || profileLoaded.current) return
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('weight_lb, preferences')
        .eq('id', user.id)
        .maybeSingle()
      
      if (data) {
        profileLoaded.current = true
        if (data.weight_lb && !bodyWeight) {
          setBodyWeight(data.weight_lb.toString())
        }
        
        const prefs = normalizePreferences(data.preferences)
        if (prefs.equipment?.inventory) {
          setEquipment({
            preset: 'custom',
            inventory: cloneInventory(prefs.equipment.inventory)
          })
        }
      }
    }
    loadProfile()
  }, [user, supabase, bodyWeight])
  
  // Computed goal based on focus - cardio/mobility have fixed goals
  const hasArmsFocus = focusAreas.includes('arms')
  const displayedFocusAreas = useMemo(
    () => resolveArmFocusTargets(focusAreas, armFocusTargets),
    [focusAreas, armFocusTargets]
  )
  const primaryFocus = useMemo(() => getPrimaryFocusArea(displayedFocusAreas, 'chest'), [displayedFocusAreas])
  const effectiveGoal = useMemo(() => getGoalForFocus(displayedFocusAreas, userGoal), [displayedFocusAreas, userGoal])
  const showGoalSelector = focusAllowsGoalSelection(displayedFocusAreas)
  
  // Readiness state
  const [readinessSurvey, setReadinessSurvey] = useState<ReadinessSurveyDraft>({
    sleep: null,
    soreness: null,
    stress: null,
    motivation: null
  })
  
  // UI state
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Computed readiness
  const readinessComplete = useMemo(() => {
    return Object.values(readinessSurvey).every(v => v !== null && v >= 1 && v <= 5)
  }, [readinessSurvey])
  
  const readinessScore = useMemo(() => {
    if (!readinessComplete) return null
    return computeReadinessScore(readinessSurvey as ReadinessSurvey)
  }, [readinessSurvey, readinessComplete])
  
  const readinessLevel = useMemo(() => {
    return getReadinessLevel(readinessScore)
  }, [readinessScore])
  
  const sessionName = useMemo(() => {
    return buildWorkoutDisplayName({
      focus: primaryFocus,
      focusAreas: displayedFocusAreas,
      style: effectiveGoal,
      minutes: parseInt(durationMinutes) || null,
      fallback: 'Past Workout'
    })
  }, [primaryFocus, displayedFocusAreas, effectiveGoal, durationMinutes])
  
  const handleReadinessChange = useCallback((field: keyof ReadinessSurvey, value: number) => {
    setReadinessSurvey(prev => ({ ...prev, [field]: value }))
  }, [])
  
  const handleCreateSession = async () => {
    if (!user) return
    const normalizedFocusAreas = resolveSessionFocusAreas(focusAreas, 'chest')
    const expandedFocusAreas = resolveArmFocusTargets(normalizedFocusAreas, armFocusTargets)
    const sessionPrimaryFocus = getPrimaryFocusArea(expandedFocusAreas, 'chest')
    if (!readinessComplete) {
      setError('Please complete the readiness survey.')
      return
    }
    const parsedDuration = parseInt(durationMinutes)
    if (!parsedDuration || parsedDuration < 1 || parsedDuration > 300) {
      setError('Please enter a valid duration (1-300 minutes).')
      return
    }
    if (!hasEquipment(equipment.inventory)) {
      setError('Please select at least one equipment option.')
      return
    }
    
    setCreating(true)
    setError(null)
    
    try {
      // Parse date and time
      const [year, month, day] = workoutDate.split('-').map(Number)
      const [hours, minutes] = startTime.split(':').map(Number)
      const startedAt = new Date(year, month - 1, day, hours, minutes)
      
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
      const bodyWeightLb = bodyWeight ? parseFloat(bodyWeight) : null
      
      // Use the computed effective goal which respects focus constraints
      const sessionGoal: SessionGoal = effectiveGoal
      const sessionIntensity = readinessLevel ? getReadinessIntensity(readinessLevel) : 'moderate'
      
      const sessionNotes = JSON.stringify({
        sessionIntensity,
        minutesAvailable: parsedDuration,
        readiness: readinessLevel,
        readinessScore,
        readinessSurvey: readinessSurvey as ReadinessSurvey,
        source: 'log_past',
        goal: sessionGoal,
        focus: sessionPrimaryFocus,
        focusAreas: expandedFocusAreas,
        armFocusTargets,
        equipmentInventory: equipment.inventory
      })
      
      // Create the session in the database
      const { data: sessionData, error: insertError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          name: sessionName,
          session_focus: sessionPrimaryFocus,
          session_goal: sessionGoal,
          session_intensity: sessionIntensity,
          status: 'in_progress',
          started_at: startedAt.toISOString(),
          ended_at: null, // Will be set when completed
          minutes_available: parsedDuration,
          timezone,
          session_notes: sessionNotes,
          body_weight_lb: bodyWeightLb
        })
        .select('id')
        .single()
      
      if (insertError || !sessionData) {
        throw insertError ?? new Error('Failed to create session.')
      }

      const { error: focusError } = await supabase.from('session_focus_areas').insert(
        expandedFocusAreas.map((focusArea) => ({
          session_id: sessionData.id,
          focus_area: focusArea
        }))
      )

      if (focusError) {
        throw focusError
      }
      
      // Insert readiness data
      await supabase.from('session_readiness').insert({
        session_id: sessionData.id,
        user_id: user.id,
        recorded_at: startedAt.toISOString(),
        sleep_quality: readinessSurvey.sleep!,
        muscle_soreness: readinessSurvey.soreness!,
        stress_level: readinessSurvey.stress!,
        motivation: readinessSurvey.motivation!,
        readiness_score: readinessScore,
        readiness_level: readinessLevel
      })
      
      // Update profile body weight if provided
      if (bodyWeightLb) {
        const { recordBodyWeight } = await import('@/lib/body-measurements')
        await recordBodyWeight({
          supabase,
          userId: user.id,
          weightLb: bodyWeightLb,
          date: startedAt,
          source: 'session',
          sessionId: sessionData.id
        })
      }
      
      // Start the session in the store (so ActiveSession can use it)
      startSession({
        id: sessionData.id,
        userId: user.id,
        name: sessionName,
        sessionFocus: sessionPrimaryFocus,
        sessionFocusAreas: expandedFocusAreas,
        sessionGoal,
        sessionIntensity,
        startedAt: startedAt.toISOString(),
        status: 'in_progress',
        timezone,
        sessionNotes,
        exercises: [],
        bodyWeightLb: bodyWeightLb ?? null
      })
      
      // Navigate to the active session page for logging
      router.push(`/sessions/${sessionData.id}/log?duration=${parsedDuration}&startTime=${encodeURIComponent(startedAt.toISOString())}`)
    } catch (err) {
      console.error('Failed to create session:', err)
      setError('Unable to create session. Please try again.')
    } finally {
      setCreating(false)
    }
  }
  
  if (userLoading) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        Loading...
      </div>
    )
  }
  
  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to log a past workout.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }
  
  if (activeSession) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">You have an active session. Please finish or cancel it first.</p>
        <Button onClick={() => router.push('/exercises/active')}>Go to active session</Button>
      </div>
    )
  }
  
  return (
    <div className="page-shell">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push('/progress')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Progress
          </Button>
        </div>
        
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-strong">Log Past Workout</h1>
          <p className="mt-2 text-muted">
            Record a workout you completed previously. Fill in the details below and then log your exercises.
          </p>
        </div>
        
        {error && (
          <div className="mb-6 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)]/10 p-4 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}
        
        <div className="grid gap-6 lg:grid-cols-3 items-start">
          <div className="space-y-6 lg:col-span-2">
            {/* Date & Time */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" />
                When did you work out?
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="workout-date">Date</Label>
                  <Input
                    id="workout-date"
                    type="date"
                    value={workoutDate}
                    onChange={(e) => setWorkoutDate(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={300}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>
            
            {/* Session Details */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                Session Details
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="session-name">Session Name (auto)</Label>
                  <div 
                    id="session-name"
                    className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-base text-[var(--color-input-text)] break-words min-h-[2.6rem]"
                    aria-readonly="true"
                  >
                    {sessionName}
                  </div>
                </div>
                <div>
                  <Label htmlFor="focus">Focus Areas</Label>
                  <div id="focus" className="mt-2 grid grid-cols-2 gap-2">
                    {FOCUS_OPTIONS.map((option) => (
                      <Checkbox
                        key={option.value}
                        label={option.label}
                        checked={focusAreas.includes(option.value)}
                        onCheckedChange={() => {
                          setFocusAreas((previous) => {
                            const next = toggleSessionFocusSelection(previous, option.value)
                            if (!next.length) return previous
                            if (!next.includes('arms')) {
                              setArmFocusTargets([])
                            }
                            return next
                          })
                        }}
                      />
                    ))}
                  </div>
                  {hasArmsFocus && (
                    <div className="mt-3 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
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
                  <p className="mt-2 text-[11px] text-subtle">
                    Cardio and Yoga / Mobility are exclusive modes. Select one of those, or combine strength focus areas.
                  </p>
                </div>
                <div>
                  <Label htmlFor="goal">Training Goal</Label>
                  {showGoalSelector ? (
                    <select
                      id="goal"
                      value={userGoal}
                      onChange={(e) => setUserGoal(e.target.value as Goal)}
                      className="input-base mt-2"
                    >
                      {STRENGTH_GOAL_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="goal"
                      type="text"
                      value={effectiveGoal === 'cardio' ? 'Cardio / Endurance' : 'Yoga / Mobility'}
                      readOnly
                      aria-readonly="true"
                      className="mt-2 bg-[var(--color-surface-muted)] cursor-not-allowed"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="body-weight">Body Weight (lb)</Label>
                  <Input
                    id="body-weight"
                    type="number"
                    value={bodyWeight}
                    onChange={(e) => setBodyWeight(e.target.value)}
                    placeholder="Optional"
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>
            
            {/* Equipment */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong mb-4 flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-accent" />
                Equipment & Weights
              </h2>
              <p className="text-sm text-muted mb-4">
                Choose the equipment you had available. This keeps exercise options and weight shortcuts fully open for past sessions.
              </p>
              <EquipmentSelector
                equipment={equipment}
                isCardioStyle={focusAreas.every((focus) => focus === 'cardio')}
                isMobilityStyle={focusAreas.every((focus) => focus === 'mobility')}
                onUpdateEquipment={(updater) => setEquipment((prev) => updater(prev))}
              />
            </Card>
          </div>
          
          <div className="space-y-6 lg:sticky lg:top-6">
            {/* Readiness Survey */}
            <Card className="p-6">
              <ReadinessCheck
                survey={readinessSurvey}
                onUpdateField={handleReadinessChange}
                score={readinessScore}
                level={readinessLevel}
              />
              
              {/* Continue Button moved inside */}
              <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                <Button
                  onClick={handleCreateSession}
                  disabled={creating || !readinessComplete}
                  className="w-full justify-center py-6 text-lg"
                >
                  {creating ? (
                    'Creating...'
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Continue to Log
                    </>
                  )}
                </Button>
                {!readinessComplete && (
                  <p className="mt-2 text-center text-sm text-muted">
                    Complete the readiness check to continue.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
