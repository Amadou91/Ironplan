'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { defaultPreferences, normalizePreferences, type OnboardingPreferences } from '@/lib/preferences'
import type { EquipmentPreset, FocusArea, Goal, RestPreference } from '@/types/domain'

const goalOptions: Array<{ value: Goal; label: string; description: string }> = [
  { value: 'strength', label: 'Strength', description: 'Heavy focus, lower reps.' },
  { value: 'hypertrophy', label: 'Hypertrophy', description: 'Balanced volume and growth.' },
  { value: 'endurance', label: 'Endurance', description: 'Higher reps and conditioning.' }
]

const experienceOptions: Array<{ value: OnboardingPreferences['experienceLevel']; label: string; description: string }> = [
  { value: 'beginner', label: 'Beginner', description: 'Learning form and consistency.' },
  { value: 'intermediate', label: 'Intermediate', description: 'Comfortable with core lifts.' },
  { value: 'advanced', label: 'Advanced', description: 'High training age and volume.' }
]

const equipmentOptions: Array<{ value: EquipmentPreset; label: string; description: string }> = [
  { value: 'home_minimal', label: 'Home minimal', description: 'Bodyweight, bands, light weights.' },
  { value: 'full_gym', label: 'Full gym', description: 'All machines and free weights.' },
  { value: 'hotel', label: 'Hotel setup', description: 'Dumbbells + limited machines.' }
]

const focusOptions: Array<{ value: FocusArea; label: string }> = [
  { value: 'full_body', label: 'Full body' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'legs', label: 'Legs' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' }
]

const restOptions: Array<{ value: RestPreference; label: string; description: string }> = [
  { value: 'high_recovery', label: 'High recovery', description: 'More rest between sets.' },
  { value: 'balanced', label: 'Balanced', description: 'Standard rest timing.' },
  { value: 'minimal_rest', label: 'Minimal rest', description: 'Keep pace high.' }
]

const steps = [
  { title: 'Primary goal', description: 'Pick the outcome you want most.' },
  { title: 'Experience level', description: 'Tune volume and intensity.' },
  { title: 'Equipment', description: 'Match workouts to your setup.' },
  { title: 'Schedule', description: 'Set days per week and time.' },
  { title: 'Focus area', description: 'Choose the body focus.' },
  { title: 'Recovery style', description: 'Define rest and recovery needs.' }
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState<OnboardingPreferences>(() => ({
    ...defaultPreferences.onboarding!
  }))
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const loadPreferences = async () => {
      const { data, error: prefError } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
      if (prefError) {
        console.error('Failed to load onboarding preferences', prefError)
      }
      const normalized = normalizePreferences(data?.preferences)
      if (normalized.onboarding) {
        setForm(normalized.onboarding)
      }
      setLoadingPrefs(false)
    }
    loadPreferences()
  }, [supabase, user])

  const progressLabel = useMemo(() => `${stepIndex + 1} / ${steps.length}`, [stepIndex])
  const currentStep = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  const handleNext = () => {
    if (isLastStep) return
    setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))
  }

  const handleBack = () => {
    setStepIndex((prev) => Math.max(0, prev - 1))
  }

  const handleFinish = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: prefError } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
      if (prefError) throw prefError
      const normalized = normalizePreferences(data?.preferences)
      const updated = {
        ...normalized,
        onboarding: form,
        onboardingCompleted: true
      }
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, preferences: updated }, { onConflict: 'id' })
      if (saveError) throw saveError
      router.push('/workouts')
    } catch (saveError) {
      console.error('Failed to save onboarding preferences', saveError)
      setError('Unable to save onboarding preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (userLoading || loadingPrefs) {
    return <div className="page-shell p-10 text-center text-muted">Loading onboarding...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to continue onboarding.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-subtle">Onboarding</p>
          <h1 className="font-display text-3xl font-semibold text-strong">Personalize your training</h1>
          <p className="mt-2 text-sm text-muted">
            These answers directly shape your generated workouts and recommendations.
          </p>
        </div>

        {error && <div className="alert-error p-4 text-sm">{error}</div>}

        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-subtle">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>{progressLabel}</span>
              </div>
              <h2 className="mt-2 text-xl font-semibold text-strong">{currentStep.title}</h2>
              <p className="mt-1 text-sm text-muted">{currentStep.description}</p>
            </div>
          </div>

          {stepIndex === 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {goalOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, goal: option.value }))}
                  className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
                    form.goal === option.value
                      ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                      : 'border-[var(--color-border)] text-muted hover:text-strong'
                  }`}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs text-subtle">{option.description}</p>
                </button>
              ))}
            </div>
          )}

          {stepIndex === 1 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {experienceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, experienceLevel: option.value }))}
                  className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
                    form.experienceLevel === option.value
                      ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                      : 'border-[var(--color-border)] text-muted hover:text-strong'
                  }`}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs text-subtle">{option.description}</p>
                </button>
              ))}
            </div>
          )}

          {stepIndex === 2 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {equipmentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, equipmentPreset: option.value }))}
                  className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
                    form.equipmentPreset === option.value
                      ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                      : 'border-[var(--color-border)] text-muted hover:text-strong'
                  }`}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs text-subtle">{option.description}</p>
                </button>
              ))}
            </div>
          )}

          {stepIndex === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-subtle">Days per week</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, daysPerWeek: value }))}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                        form.daysPerWeek === value
                          ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                          : 'border-[var(--color-border)] text-muted hover:text-strong'
                      }`}
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-subtle">Minutes per session</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[30, 45, 60, 75].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, minutesPerSession: value }))}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                        form.minutesPerSession === value
                          ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                          : 'border-[var(--color-border)] text-muted hover:text-strong'
                      }`}
                    >
                      {value} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stepIndex === 4 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {focusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, focusAreas: [option.value] }))}
                  className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
                    form.focusAreas.includes(option.value)
                      ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                      : 'border-[var(--color-border)] text-muted hover:text-strong'
                  }`}
                >
                  <p className="font-semibold">{option.label}</p>
                </button>
              ))}
            </div>
          )}

          {stepIndex === 5 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {restOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, restPreference: option.value }))}
                  className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
                    form.restPreference === option.value
                      ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                      : 'border-[var(--color-border)] text-muted hover:text-strong'
                  }`}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs text-subtle">{option.description}</p>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={stepIndex === 0}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push('/workouts')}>
                Skip for now
              </Button>
              {isLastStep ? (
                <Button type="button" onClick={handleFinish} disabled={saving}>
                  {saving ? 'Saving...' : 'Finish onboarding'}
                </Button>
              ) : (
                <Button type="button" onClick={handleNext}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
