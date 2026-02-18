'use client'

import { useState, useEffect } from 'react'
import { Ruler } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { defaultPreferences, normalizePreferences, type SettingsPreferences } from '@/lib/preferences'
import { useUIStore } from '@/store/uiStore'

interface AppSettingsProps {
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

export function AppSettings({ onSuccess, onError }: AppSettingsProps) {
  const supabase = createClient()
  const { user } = useUser()
  const setDisplayUnit = useUIStore((state) => state.setDisplayUnit)
  
  const [settings, setSettings] = useState<SettingsPreferences>(() => ({
    ...defaultPreferences.settings!
  }))
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveSettingsState, setSaveSettingsState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

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
      setHasUnsavedChanges(false)
      setSaveSettingsState('idle')
      setLoadingPrefs(false)
    }
    loadSettings()
  }, [user, supabase])

  const persistPreferences = async (nextSettings: SettingsPreferences) => {
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
        settings: nextSettings,
      }
      
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, preferences: updated }, { onConflict: 'id' })
      
      if (saveError) throw saveError
      setSaveSettingsState('saved')
      setHasUnsavedChanges(false)
      onSuccess?.('Preferences saved.')
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
      if (next.units !== prev.units) {
        setDisplayUnit(next.units)
      }
      if (!loadingPrefs && JSON.stringify(next) !== JSON.stringify(prev)) {
        setHasUnsavedChanges(true)
        if (saveSettingsState !== 'saving') {
          setSaveSettingsState('idle')
        }
      }
      return next
    })
  }

  const handleSavePreferences = async () => {
    if (!user || !hasUnsavedChanges) return
    await persistPreferences(settings)
  }

  return (
    <div className="grid grid-cols-1 gap-6">
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
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-subtle">
          {hasUnsavedChanges ? 'You have unsaved changes.' : 'All changes saved.'}
        </p>
        {saveSettingsState === 'saved' ? (
          <p className="text-[10px] text-accent font-medium">Saved</p>
        ) : null}
      </div>

      <div className="md:hidden sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-20 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface),transparent_8%)] p-2 backdrop-blur">
        <Button
          type="button"
          size="md"
          className="w-full"
          onClick={handleSavePreferences}
          disabled={!hasUnsavedChanges || saveSettingsState === 'saving'}
        >
          {saveSettingsState === 'saving' ? 'Saving...' : 'Save preferences'}
        </Button>
      </div>
    </div>
  )
}
