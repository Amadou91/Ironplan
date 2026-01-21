'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Lock, PlugZap, Ruler } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { defaultPreferences, normalizePreferences, type SettingsPreferences } from '@/lib/preferences'

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  const [settings, setSettings] = useState<SettingsPreferences>(() => ({
    ...defaultPreferences.settings!
  }))
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoadingPrefs(false)
      return
    }
    let isMounted = true
    const loadSettings = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        console.error('Failed to load settings preferences', error)
      }
      const normalized = normalizePreferences(data?.preferences)
      if (isMounted && normalized.settings) {
        setSettings(normalized.settings)
      }
      if (isMounted) {
        setLoadingPrefs(false)
      }
    }
    loadSettings()
    return () => {
      isMounted = false
    }
  }, [supabase, user])

  const persistSettings = async (next: SettingsPreferences) => {
    if (!user) return
    setSaveState('saving')
    setSaveError(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
      if (error) throw error
      const normalized = normalizePreferences(data?.preferences)
      const updated = {
        ...normalized,
        settings: next
      }
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, preferences: updated }, { onConflict: 'id' })
      if (saveError) throw saveError
      setSaveState('saved')
    } catch (saveError) {
      console.error('Failed to save settings preferences', saveError)
      setSaveState('error')
      setSaveError('Unable to save settings. Please try again.')
    }
  }

  const updateSettings = (updater: (prev: SettingsPreferences) => SettingsPreferences) => {
    setSettings((prev) => {
      const next = updater(prev)
      if (!loadingPrefs) {
        void persistSettings(next)
      }
      return next
    })
  }

  if (userLoading || loadingPrefs) {
    return <div className="page-shell p-10 text-center text-muted">Loading settings...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to manage your settings.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-subtle">Settings</p>
          <h1 className="font-display text-3xl font-semibold text-strong">Preferences and controls</h1>
          <p className="mt-2 text-sm text-muted">
            Tailor units, notifications, and privacy to match your training style.
          </p>
          {saveState === 'error' && saveError && (
            <div className="mt-3 alert-error px-3 py-2 text-xs">{saveError}</div>
          )}
          {saveState === 'saved' && <p className="mt-3 text-xs text-muted">Preferences saved.</p>}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Ruler className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-sm font-semibold text-strong">Units</h2>
                <p className="text-xs text-subtle">Choose your preferred measurement system.</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={settings.units === 'lb' ? 'primary' : 'secondary'}
                onClick={() =>
                  updateSettings((prev) => ({
                    ...prev,
                    units: 'lb'
                  }))
                }
              >
                Pounds (lb)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={settings.units === 'kg' ? 'primary' : 'secondary'}
                onClick={() =>
                  updateSettings((prev) => ({
                    ...prev,
                    units: 'kg'
                  }))
                }
              >
                Kilograms (kg)
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-sm font-semibold text-strong">Notifications</h2>
                <p className="text-xs text-subtle">Stay motivated with timely reminders.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <label className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                <span>Workout reminders</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.workoutReminders}
                  onChange={(event) =>
                    updateSettings((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        workoutReminders: event.target.checked
                      }
                    }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                <span>Weekly progress summary</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.weeklySummary}
                  onChange={(event) =>
                    updateSettings((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        weeklySummary: event.target.checked
                      }
                    }))
                  }
                />
              </label>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-sm font-semibold text-strong">Privacy</h2>
                <p className="text-xs text-subtle">Decide how your data is shared.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <label className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                <span>Share progress with coach</span>
                <input
                  type="checkbox"
                  checked={settings.shareProgress}
                  onChange={(event) =>
                    updateSettings((prev) => ({
                      ...prev,
                      shareProgress: event.target.checked
                    }))
                  }
                />
              </label>
              <p className="text-xs text-subtle">
                Enable this to share performance insights with your trainer or accountability partner.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <PlugZap className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-sm font-semibold text-strong">Integrations</h2>
                <p className="text-xs text-subtle">Connect devices and services.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <div className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-4 text-center">
                No integrations connected yet.
              </div>
              <Button variant="secondary" size="sm">
                Browse integrations
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
