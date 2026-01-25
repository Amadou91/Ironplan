'use client'

import { useState, useEffect } from 'react'
import { Ruler, Bell, Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { defaultPreferences, normalizePreferences, type SettingsPreferences } from '@/lib/preferences'
import { seedDevData, clearDevData } from '@/lib/dev-seed'

interface AppSettingsProps {
  devToolsEnabled: boolean
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

export function AppSettings({ devToolsEnabled, onSuccess, onError }: AppSettingsProps) {
  const supabase = createClient()
  const { user } = useUser()
  
  const [settings, setSettings] = useState<SettingsPreferences>(() => ({
    ...defaultPreferences.settings!
  }))
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [saveSettingsState, setSaveSettingsState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [devActionState, setDevActionState] = useState<'idle' | 'seeding' | 'clearing'>('idle')
  const [devActionMessage, setDevActionMessage] = useState<string | null>(null)
  const isDevMode = process.env.NODE_ENV !== 'production'

  useEffect(() => {
    if (!user) return
    const loadSettings = async () => {
      setLoadingPrefs(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!error && data?.preferences) {
        const normalized = normalizePreferences(data.preferences)
        if (normalized.settings) {
          setSettings(normalized.settings)
        }
      }
      setLoadingPrefs(false)
    }
    loadSettings()
  }, [user, supabase])

  const persistSettings = async (next: SettingsPreferences) => {
    if (!user) return
    setSaveSettingsState('saving')
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
      setSaveSettingsState('saved')
      setTimeout(() => setSaveSettingsState('idle'), 2000)
    } catch (err) {
      console.error('Failed to save settings', err)
      setSaveSettingsState('error')
      onError?.('Unable to save settings.')
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

  const handleSeedData = async () => {
    if (!user || devActionState !== 'idle') return
    const confirmed = window.confirm(
      'This will insert a batch of simulated workout data for your account. Run "Clear seeded data" to remove it later.'
    )
    if (!confirmed) return
    setDevActionState('seeding')
    setDevActionMessage(null)
    try {
      const result = await seedDevData(supabase, user.id)
      const readiness = result.readiness ? `, ${result.readiness} readiness entries` : ''
      setDevActionMessage(
        `Seeded ${result.templates} templates, ${result.sessions} sessions, ${result.exercises} exercises, ${result.sets} sets${readiness}.`
      )
      onSuccess?.('Development data seeded.')
    } catch (error) {
      console.error('Failed to seed dev data', error)
      onError?.('Unable to seed dev data.')
    } finally {
      setDevActionState('idle')
    }
  }

  const handleClearSeededData = async () => {
    if (!user || devActionState !== 'idle') return
    const confirmed = window.confirm(
      'This will delete all seeded workout templates and sessions for your account. This cannot be undone.'
    )
    if (!confirmed) return
    setDevActionState('clearing')
    setDevActionMessage(null)
    try {
      const result = await clearDevData(supabase, user.id)
      const readiness = result.readiness ? `, ${result.readiness} readiness entries` : ''
      const measurements = result.measurements ? `, ${result.measurements} body measurements` : ''
      setDevActionMessage(
        `Cleared ${result.templates} templates, ${result.sessions} sessions${readiness}${measurements}.`
      )
      onSuccess?.('Seeded data cleared.')
    } catch (error) {
      console.error('Failed to clear dev data', error)
      onError?.('Unable to clear dev data.')
    } finally {
      setDevActionState('idle')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-strong">Appearance</h2>
              <p className="text-xs text-subtle">Customize how Ironplan looks on your device.</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </Card>

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
            onClick={() => updateSettings((prev) => ({ ...prev, units: 'lb' }))}
          >
            Pounds (lb)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={settings.units === 'kg' ? 'primary' : 'secondary'}
            onClick={() => updateSettings((prev) => ({ ...prev, units: 'kg' }))}
          >
            Kilograms (kg)
          </Button>
        </div>
        {saveSettingsState === 'saved' && (
          <p className="mt-2 text-[10px] text-accent font-medium">Preferences saved</p>
        )}
      </Card>

      <Card className="p-6 opacity-60">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-sm font-semibold text-strong">Notifications</h2>
            <p className="text-xs text-subtle">Manage how you receive alerts and reminders.</p>
          </div>
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-wider text-subtle font-bold">Coming soon</p>
      </Card>

      {devToolsEnabled && isDevMode && (
        <Card className="p-6 border-accent/20 bg-accent/5">
          <div>
            <h2 className="text-sm font-semibold text-strong">Developer tools</h2>
            <p className="text-xs text-subtle">
              Seed temporary workout data for development and wipe it clean when you are done.
            </p>
          </div>
          {devActionMessage && <p className="mt-3 text-xs text-accent font-medium">{devActionMessage}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSeedData}
              disabled={devActionState !== 'idle'}
            >
              {devActionState === 'seeding' ? 'Seeding...' : 'Seed dev data'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleClearSeededData}
              disabled={devActionState !== 'idle'}
            >
              {devActionState === 'clearing' ? 'Clearing...' : 'Clear seeded data'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
