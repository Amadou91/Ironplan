'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ruler } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { defaultPreferences, normalizePreferences, type SettingsPreferences } from '@/lib/preferences'
import { clearDevData, seedDevData } from '@/lib/dev-seed'

export default function SettingsPage() {
  const devToolsKey = 'ironplan-dev-tools'
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  const [settings, setSettings] = useState<SettingsPreferences>(() => ({
    ...defaultPreferences.settings!
  }))
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [devToolsEnabled, setDevToolsEnabled] = useState(false)
  const [devToolsNotice, setDevToolsNotice] = useState<string | null>(null)
  const [devActionState, setDevActionState] = useState<'idle' | 'seeding' | 'clearing'>('idle')
  const [devActionMessage, setDevActionMessage] = useState<string | null>(null)
  const [devActionError, setDevActionError] = useState<string | null>(null)
  const titleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleClickCount = useRef(0)
  const isDevMode = process.env.NODE_ENV !== 'production'

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

  useEffect(() => {
    if (!isDevMode) return
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(devToolsKey)
    setDevToolsEnabled(saved === 'true')
  }, [devToolsKey, isDevMode])

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

  const toggleDevTools = () => {
    if (!isDevMode || typeof window === 'undefined') return
    setDevToolsEnabled((prev) => {
      const nextEnabled = !prev
      window.localStorage.setItem(devToolsKey, String(nextEnabled))
      setDevToolsNotice(nextEnabled ? 'Developer tools enabled.' : 'Developer tools hidden.')
      window.setTimeout(() => setDevToolsNotice(null), 2000)
      return nextEnabled
    })
  }

  const handleTitleClick = () => {
    if (!isDevMode) return
    titleClickCount.current += 1
    if (titleClickTimeout.current) {
      window.clearTimeout(titleClickTimeout.current)
    }
    titleClickTimeout.current = window.setTimeout(() => {
      titleClickCount.current = 0
    }, 1200)
    if (titleClickCount.current >= 5) {
      titleClickCount.current = 0
      toggleDevTools()
    }
  }

  const handleSeedData = async () => {
    if (!user || devActionState !== 'idle') return
    const confirmed = window.confirm(
      'This will insert a batch of simulated workout data for your account. Run "Clear seeded data" to remove it later.'
    )
    if (!confirmed) return
    setDevActionState('seeding')
    setDevActionError(null)
    setDevActionMessage(null)
    try {
      const result = await seedDevData(supabase, user.id)
      const readiness = result.readiness ? `, ${result.readiness} readiness entries` : ''
      setDevActionMessage(
        `Seeded ${result.templates} templates, ${result.sessions} sessions, ${result.exercises} exercises, ${result.sets} sets${readiness}.`
      )
    } catch (error) {
      console.error('Failed to seed dev data', error)
      setDevActionError('Unable to seed dev data. Check the console for details.')
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
    setDevActionError(null)
    setDevActionMessage(null)
    try {
      const result = await clearDevData(supabase, user.id)
      const readiness = result.readiness ? `, ${result.readiness} readiness entries` : ''
      setDevActionMessage(
        `Cleared ${result.templates} templates, ${result.sessions} sessions${readiness}.`
      )
    } catch (error) {
      console.error('Failed to clear dev data', error)
      setDevActionError('Unable to clear dev data. Check the console for details.')
    } finally {
      setDevActionState('idle')
    }
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
          <h1
            className="font-display text-3xl font-semibold text-strong"
            onClick={handleTitleClick}
          >
            Preferences and controls
          </h1>
          <p className="mt-2 text-sm text-muted">
            Keep your measurement units consistent across workouts and logs.
          </p>
          {saveState === 'error' && saveError && (
            <div className="mt-3 alert-error px-3 py-2 text-xs">{saveError}</div>
          )}
          {saveState === 'saved' && <p className="mt-3 text-xs text-muted">Preferences saved.</p>}
          {devToolsNotice && <p className="mt-3 text-xs text-muted">{devToolsNotice}</p>}
        </div>

        <div className="space-y-6">
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

          {devToolsEnabled && isDevMode && (
            <Card className="p-6">
              <div>
                <h2 className="text-sm font-semibold text-strong">Developer tools</h2>
                <p className="text-xs text-subtle">
                  Seed temporary workout data for development and wipe it clean when you are done.
                </p>
              </div>
              {devActionError && <div className="mt-3 alert-error px-3 py-2 text-xs">{devActionError}</div>}
              {devActionMessage && <p className="mt-3 text-xs text-muted">{devActionMessage}</p>}
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
      </div>
    </div>
  )
}
