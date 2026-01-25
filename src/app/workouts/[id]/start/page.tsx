'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Clock, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { normalizePlanInput } from '@/lib/generator'
import { createWorkoutSession } from '@/lib/session-creation'
import { fetchTemplateHistory } from '@/lib/session-history'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { computeReadinessScore, getReadinessIntensity, getReadinessLevel, type ReadinessSurvey } from '@/lib/training-metrics'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { FocusArea, Goal, PlanInput } from '@/types/domain'
import { ReadinessCheck, READINESS_FIELDS } from '@/components/workout/start/ReadinessCheck'
import { SessionPreview } from '@/components/workout/start/SessionPreview'

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

const shiftExperienceLevel = (base: PlanInput['experienceLevel'], delta: -1 | 0 | 1) => {
  const index = EXPERIENCE_LEVELS.indexOf(base)
  if (index === -1) return base
  const nextIndex = Math.max(0, Math.min(EXPERIENCE_LEVELS.length - 1, index + delta))
  return EXPERIENCE_LEVELS[nextIndex]
}

export default function WorkoutStartPage() {
  const params = useParams()
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
  const [minutesAvailable, setMinutesAvailable] = useState(45)
  const [readinessSurvey, setReadinessSurvey] = useState<ReadinessSurveyDraft>({
    sleep: null, soreness: null, stress: null, motivation: null
  })

  useEffect(() => {
    const fetchTemplate = async () => {
      const { data, error } = await supabase.from('workout_templates').select('*').eq('id', params.id).single()
      if (!error) {
        setTemplate(data)
        setMinutesAvailable(data?.template_inputs?.time?.minutesPerSession ?? 45)
      }
      setLoading(false)
    }
    if (params.id) fetchTemplate()
  }, [params.id, supabase])

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
          restPreference: selectedIntensity.restPreference 
        } 
      }
      const history = await fetchTemplateHistory(supabase, template.id)
      const { sessionId, startedAt, sessionName, exercises, impact, timezone, sessionNotes } = await createWorkoutSession({
        supabase, userId: user.id, templateId: template.id, templateTitle: buildWorkoutDisplayName({ focus: template.focus, style: template.style, intensity: template.intensity, fallback: template.title }),
        focus: template.focus, goal: template.style, input: tunedInputs, minutesAvailable, readiness: { survey: readinessSurvey as ReadinessSurvey, score: readinessScore, level: readinessLevel },
        sessionNotes: { sessionIntensity: selectedIntensity.intensity, minutesAvailable, readiness: readinessLevel, readinessScore, readinessSurvey: readinessSurvey as ReadinessSurvey, source: 'workout_start' },
        history, nameSuffix: `${toMuscleLabel(template.focus)} ${template.style.replace('_', ' ')}`
      })
      startSession({ id: sessionId, userId: user.id, templateId: template.id, name: sessionName, startedAt, status: 'in_progress', impact, exercises, timezone, sessionNotes })
      router.push(`/workouts/${template.id}/active?sessionId=${sessionId}&from=start`)
    } catch { setStartError('Unable to start the session.') } finally { setStartingSession(false) }
  }

  if (loading) return <div className="page-shell p-10 text-center text-muted">Loading session setup...</div>
  if (!template) return <div className="page-shell p-10 text-center text-muted">Template not found.</div>

  const activeSessionLink = activeSession?.templateId ? `/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=workouts` : '/dashboard'

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold text-strong">Start {buildWorkoutDisplayName({ focus: template.focus, style: template.style, intensity: template.intensity, fallback: template.title })}</h1>
            {template.description && <p className="text-sm text-muted">{template.description}</p>}
          </div>
        </div>
        {startError && <div className="alert-error p-4 text-sm mb-6">{startError}</div>}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4"><Clock className="h-5 w-5 text-accent" /><h2 className="text-lg font-semibold text-strong">Session settings</h2></div>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-xs text-subtle"><span>Minutes available</span><span className="text-strong">{minutesAvailable} min</span></div>
                  <input type="range" min={20} max={120} step={5} value={minutesAvailable} onChange={(e) => setMinutesAvailable(Number(e.target.value))} className="mt-3 w-full" />
                  <div className="mt-3 flex flex-wrap gap-2">{[30, 45, 60, 75].map((v) => <Button key={v} size="sm" variant={minutesAvailable === v ? 'primary' : 'secondary'} onClick={() => setMinutesAvailable(v)}>{v} min</Button>)}</div>
                </div>
                <ReadinessCheck survey={readinessSurvey} onUpdateField={(f, v) => setReadinessSurvey(p => ({ ...p, [f]: v }))} score={readinessScore} level={readinessLevel} />
              </div>
            </Card>
            <SessionPreview focus={template.focus} style={template.style} intensityLabel={readinessLevel ? selectedIntensity.label : 'Pending readiness'} equipmentInventory={template.template_inputs?.equipment?.inventory} />
          </div>
          <div className="space-y-4">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-strong">Ready to train?</h2>
              <p className="mt-2 text-sm text-muted">We will adapt this plan to your time, readiness, and equipment.</p>
              <Button type="button" onClick={() => handleStartSession()} disabled={startingSession || !readinessComplete} className="mt-4 w-full justify-center">{startingSession ? 'Starting...' : 'Start Session'}</Button>
              {activeSession && <p className="mt-3 text-center text-xs font-medium text-accent">Session in progress</p>}
              <p className="mt-3 text-xs text-subtle">{readinessLevel ? `Readiness is ${readinessLevel}. Intensity set to ${selectedIntensity.label}.` : 'Complete readiness to set intensity.'}</p>
            </Card>
          </div>
        </div>
      </div>
      {showConflictModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="surface-elevated w-full max-w-md p-6 shadow-2xl border border-[var(--color-border-strong)]">
            <div className="flex items-center gap-3 text-[var(--color-warning)] mb-4"><AlertTriangle size={24} /><h3 className="text-xl font-bold text-strong">Session in Progress</h3></div>
            <p className="text-sm text-muted mb-6">You already have an active workout session. Would you like to continue it, or cancel it and start this new one?</p>
            <div className="space-y-3">
              <Button className="w-full justify-center py-6" onClick={() => router.push(activeSessionLink)}>Continue Current Session</Button>
              <Button variant="ghost" className="w-full justify-center text-[var(--color-danger)]" onClick={() => handleStartSession(true)} disabled={startingSession}>{startingSession ? 'Starting...' : 'Cancel & Start New'}</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => setShowConflictModal(false)}>Go Back</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}