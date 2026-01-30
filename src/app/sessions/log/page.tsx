'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Target, Play, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { EquipmentSelector } from '@/components/generate/EquipmentSelector'
import { ReadinessCheck } from '@/components/workout/start/ReadinessCheck'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { cloneInventory, equipmentPresets, hasEquipment } from '@/lib/equipment'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import {
  computeReadinessScore,
  getReadinessIntensity,
  getReadinessLevel,
  type ReadinessSurvey
} from '@/lib/training-metrics'
import type { FocusArea, Goal, PlanInput, SessionGoal } from '@/types/domain'

type ReadinessSurveyDraft = {
  [Key in keyof ReadinessSurvey]: number | null
}

/**
 * Canonical focus options for user-selectable focus areas.
 * Must match MuscleGroupSelector for consistency.
 */
const FOCUS_OPTIONS: { value: FocusArea; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Yoga / Mobility' }
]

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
const getGoalForFocus = (focus: FocusArea, userGoal: Goal): Goal => {
  if (focus === 'mobility') return 'range_of_motion'
  if (focus === 'cardio') return 'cardio'
  return userGoal
}

/**
 * Checks if the focus area allows user to select a goal.
 */
const focusAllowsGoalSelection = (focus: FocusArea): boolean => {
  return focus !== 'mobility' && focus !== 'cardio'
}

function formatDateForInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function LogPastWorkoutPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  useExerciseCatalog() // Preload catalog for downstream components
  const startSession = useWorkoutStore((state) => state.startSession)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  
  // Session setup state
  const [workoutDate, setWorkoutDate] = useState(formatDateForInput(new Date()))
  const [startTime, setStartTime] = useState('09:00')
  const [durationMinutes, setDurationMinutes] = useState('45')
  const [focus, setFocus] = useState<FocusArea>('chest')
  const [userGoal, setUserGoal] = useState<Goal>('hypertrophy')
  const [bodyWeight, setBodyWeight] = useState('')
  const [equipment, setEquipment] = useState<PlanInput['equipment']>(() => ({
    preset: 'full_gym',
    inventory: cloneInventory(equipmentPresets.full_gym)
  }))
  
  // Computed goal based on focus - cardio/mobility have fixed goals
  const effectiveGoal = useMemo(() => getGoalForFocus(focus, userGoal), [focus, userGoal])
  const showGoalSelector = focusAllowsGoalSelection(focus)
  
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
      focus,
      style: effectiveGoal,
      minutes: parseInt(durationMinutes) || null,
      fallback: 'Past Workout'
    })
  }, [focus, effectiveGoal, durationMinutes])
  
  const handleReadinessChange = useCallback((field: keyof ReadinessSurvey, value: number) => {
    setReadinessSurvey(prev => ({ ...prev, [field]: value }))
  }, [])
  
  const handleCreateSession = async () => {
    if (!user) return
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
        focus,
        equipmentInventory: equipment.inventory
      })
      
      // Create the session in the database
      const { data: sessionData, error: insertError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          name: sessionName,
          session_focus: focus,
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
        await supabase.from('profiles').update({ weight_lb: bodyWeightLb }).eq('id', user.id)
      }
      
      // Start the session in the store (so ActiveSession can use it)
      startSession({
        id: sessionData.id,
        userId: user.id,
        name: sessionName,
        sessionFocus: focus,
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
                  <Label htmlFor="focus">Focus Area</Label>
                  <select
                    id="focus"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value as FocusArea)}
                    className="input-base mt-2"
                  >
                    {FOCUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
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
                      value={focus === 'cardio' ? 'Cardio / Endurance' : 'Yoga / Mobility'}
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
                isCardioStyle={focus === 'cardio'}
                isMobilityStyle={focus === 'mobility'}
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
