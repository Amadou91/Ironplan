'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ruler } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { defaultPreferences, normalizePreferences, type SettingsPreferences } from '@/lib/preferences'
import { clearDevData, seedDevData } from '@/lib/dev-seed'

type ProfileRow = {
  id: string
  height_in: number | null
  weight_lb: number | null
  body_fat_percent: number | null
  birthdate: string | null
  sex: string | null
  updated_at: string | null
}

type ProfileDraft = {
  weightLb: string
  heightFeet: string
  heightInches: string
  bodyFatPercent: string
  birthdate: string
  sex: string
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  // If it's a date-only string (YYYY-MM-DD) or UTC midnight, avoid UTC shift by parsing as local components
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value.endsWith('T00:00:00.000Z') || value.endsWith('T00:00:00Z')) {
    const [year, month, day] = value.split('T')[0].split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDateForInput = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseNumberInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const formatHeightFromInches = (heightIn?: number | null) => {
  if (typeof heightIn !== 'number' || !Number.isFinite(heightIn) || heightIn <= 0) return ''
  const rounded = Math.round(heightIn)
  const feet = Math.floor(rounded / 12)
  const inches = rounded - feet * 12
  if (feet <= 0) return `${rounded} in`
  return `${feet}' ${inches}"`
}

const calculateAge = (birthdate?: string | null) => {
  if (!birthdate) return null
  const date = new Date(birthdate)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDelta = now.getMonth() - date.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) {
    age -= 1
  }
  return age
}

const calculateBmi = (weightLb?: number | null, heightIn?: number | null) => {
  if (!weightLb || !heightIn) return null
  if (weightLb <= 0 || heightIn <= 0) return null
  return (weightLb / (heightIn * heightIn)) * 703
}

const calculateBmr = (
  weightLb?: number | null,
  heightIn?: number | null,
  age?: number | null,
  sex?: string | null
) => {
  if (!weightLb || !heightIn || typeof age !== 'number') return null
  if (!sex || (sex !== 'male' && sex !== 'female')) return null
  const weightKg = weightLb / 2.20462
  const heightCm = heightIn * 2.54
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  
  // Profile State
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    weightLb: '',
    heightFeet: '',
    heightInches: '',
    bodyFatPercent: '',
    birthdate: '',
    sex: ''
  })
  const [profileSnapshot, setProfileSnapshot] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)

  // Settings/Dev State
  const devToolsKey = 'ironplan-dev-tools'
  const [settings, setSettings] = useState<SettingsPreferences>(() => ({
    ...defaultPreferences.settings!
  }))
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [saveSettingsState, setSaveSettingsState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveSettingsError, setSaveSettingsError] = useState<string | null>(null)
  const [devToolsEnabled, setDevToolsEnabled] = useState(false)
  const [devToolsNotice, setDevToolsNotice] = useState<string | null>(null)
  const [devActionState, setDevActionState] = useState<'idle' | 'seeding' | 'clearing'>('idle')
  const [devActionMessage, setDevActionMessage] = useState<string | null>(null)
  const [devActionError, setDevActionError] = useState<string | null>(null)
  
  // Manual Weight State
  const [manualWeight, setManualWeight] = useState('')
  const [manualDate, setManualDate] = useState(formatDateForInput(new Date()))
  const [manualHistory, setManualHistory] = useState<Array<{ id: string; weight_lb: number; recorded_at: string }>>([])
  const [manualLoading, setManualLoading] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualDeletingId, setManualDeletingId] = useState<string | null>(null)
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false)
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const titleClickTimeout = useRef<any>(null)
  const titleClickCount = useRef(0)
  const isDevMode = process.env.NODE_ENV !== 'production'

  const ensureSession = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !data.session) {
      setUser(null)
      setProfileError('Your session has expired. Please sign in again.')
      return null
    }
    return data.session
  }, [setUser, supabase])

  // Load Profile & Settings
  useEffect(() => {
    if (userLoading) return
    if (!user) {
      setLoadingPrefs(false)
      return
    }

    const loadData = async () => {
      setProfileLoading(true)
      setProfileError(null)
      setProfileSuccess(null)
      
      const session = await ensureSession()
      if (!session) {
        setProfileLoading(false)
        setLoadingPrefs(false)
        return
      }
      const sessionUserId = session.user.id
      
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, height_in, weight_lb, body_fat_percent, birthdate, sex, updated_at, preferences')
        .eq('id', sessionUserId)
        .maybeSingle()

      if (fetchError) {
        console.error('Failed to load profile data', fetchError, fetchError.message)
        setProfileError('Unable to load your profile data. Please try again.')
      } else {
        // Parse Profile
        const heightIn = typeof data?.height_in === 'number' ? Math.round(data.height_in) : null
        const heightFeet = typeof heightIn === 'number' ? Math.floor(heightIn / 12) : null
        const heightInches = typeof heightIn === 'number' ? heightIn - (heightFeet ?? 0) * 12 : null
        const nextDraft = {
          weightLb: typeof data?.weight_lb === 'number' ? String(data.weight_lb) : '',
          heightFeet: typeof heightFeet === 'number' ? String(heightFeet) : '',
          heightInches: typeof heightInches === 'number' ? String(heightInches) : '',
          bodyFatPercent: typeof data?.body_fat_percent === 'number' ? String(data.body_fat_percent) : '',
          birthdate: data?.birthdate ?? '',
          sex: data?.sex ?? ''
        }
        setProfile(data ? (data as ProfileRow) : null)
        setProfileDraft(nextDraft)
        setProfileSnapshot(JSON.stringify(nextDraft))

        // Parse Settings
        const normalized = normalizePreferences(data?.preferences)
        if (normalized.settings) {
          setSettings(normalized.settings)
        }
      }
      setProfileLoading(false)
      setLoadingPrefs(false)
    }

    const loadManualHistory = async () => {
      if (!user) return
      setManualLoading(true)
      const { data, error } = await supabase
        .from('body_measurements')
        .select('id, weight_lb, recorded_at')
        .eq('user_id', user.id)
        .eq('source', 'user')
        .order('recorded_at', { ascending: false })
        .limit(20)
      
      if (!error && data) {
        setManualHistory(data)
      }
      setManualLoading(false)
    }

    loadData()
    loadManualHistory()
  }, [ensureSession, supabase, user, userLoading])

  const handleEditManualWeight = (entry: { id: string; weight_lb: number; recorded_at: string }) => {
    setEditingWeightId(entry.id)
    setManualWeight(String(entry.weight_lb))
    setManualDate(formatDateForInput(new Date(entry.recorded_at)))
    setIsWeightModalOpen(true)
  }

  const handleSaveManualWeight = async () => {
    if (!user || !manualWeight) return
    const weight = parseFloat(manualWeight)
    if (isNaN(weight) || weight <= 0) return
    
    setManualSaving(true)
    try {
      const recordedAt = manualDate // Use YYYY-MM-DD string directly from input
      
      if (editingWeightId) {
        const { data, error } = await supabase
          .from('body_measurements')
          .update({
            weight_lb: weight,
            recorded_at: recordedAt
          })
          .eq('id', editingWeightId)
          .select('id, weight_lb, recorded_at')
          .single()
        
        if (!error && data) {
          // Keep recorded_at as the literal date string returned from the DB
          setManualHistory(prev => prev.map(item => item.id === editingWeightId ? data : item).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)))
          setProfileSuccess('Weight entry updated.')
        }
      } else {
        // Upsert by literal date string to enforce one-per-day correctly in local time
        const { data, error } = await supabase
          .from('body_measurements')
          .upsert({
            user_id: user.id,
            weight_lb: weight,
            recorded_at: recordedAt,
            source: 'user'
          }, { onConflict: 'user_id,recorded_at,source' }) // Match the unique constraint if available, or just insert
          .select('id, weight_lb, recorded_at')
          .single()
        
        if (!error && data) {
          setManualHistory(prev => {
            const filtered = prev.filter(item => item.recorded_at !== recordedAt)
            return [data, ...filtered].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).slice(0, 20)
          })
          setProfileSuccess('Weight logged.')
        } else if (error) {
          // If upsert fails due to policy or missing constraint, try manual one-per-day enforcement
          const { data: existing } = await supabase
            .from('body_measurements')
            .select('id')
            .eq('user_id', user.id)
            .eq('recorded_at', recordedAt)
            .eq('source', 'user')
            .maybeSingle()

          if (existing) {
            const { data: updated, error: upError } = await supabase
              .from('body_measurements')
              .update({ weight_lb: weight })
              .eq('id', existing.id)
              .select('id, weight_lb, recorded_at')
              .single()
            
            if (!upError && updated) {
              setManualHistory(prev => prev.map(item => item.id === existing.id ? updated : item))
              setProfileSuccess('Weight entry updated for this day.')
            }
          } else {
            const { data: inserted, error: inError } = await supabase
              .from('body_measurements')
              .insert({
                user_id: user.id,
                weight_lb: weight,
                recorded_at: recordedAt,
                source: 'user'
              })
              .select('id, weight_lb, recorded_at')
              .single()
            
            if (!inError && inserted) {
              setManualHistory(prev => [inserted, ...prev].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).slice(0, 20))
              setProfileSuccess('Weight logged.')
            }
          }
        }
      }

      // Update profile with latest weight if this is the newest entry
      const { data: latest } = await supabase
        .from('body_measurements')
        .select('weight_lb')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()
      
      if (latest) {
        await supabase.from('profiles').update({ weight_lb: latest.weight_lb }).eq('id', user.id)
        setProfileDraft(prev => ({ ...prev, weightLb: String(latest.weight_lb) }))
      }

      setManualWeight('')
      setManualDate(formatDateForInput(new Date()))
      setEditingWeightId(null)
      setIsWeightModalOpen(false)
    } catch (err) {
      console.error('Failed to save weight', err)
    } finally {
      setManualSaving(false)
    }
  }

  const handleDeleteManualWeight = async (id: string) => {
    if (!confirm('Remove this weight entry?')) return
    setManualDeletingId(id)
    try {
      const { error } = await supabase
        .from('body_measurements')
        .delete()
        .eq('id', id)
      
      if (!error) {
        setManualHistory(prev => prev.filter(item => item.id !== id))
        setProfileSuccess('Entry removed.')
      }
    } catch (err) {
      console.error('Failed to delete weight entry', err)
    } finally {
      setManualDeletingId(null)
    }
  }

  // Dev Tools Persistence
  useEffect(() => {
    if (!isDevMode) return
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(devToolsKey)
    setDevToolsEnabled(saved === 'true')
  }, [devToolsKey, isDevMode])

  const profileHasChanges = useMemo(() => {
    if (!profileSnapshot) {
      return Object.values(profileDraft).some((value) => value.trim().length > 0)
    }
    return JSON.stringify(profileDraft) !== profileSnapshot
  }, [profileDraft, profileSnapshot])

  const profileMetrics = useMemo(() => {
    const weightLb = parseNumberInput(profileDraft.weightLb)
    const heightFeet = parseNumberInput(profileDraft.heightFeet)
    const heightInches = parseNumberInput(profileDraft.heightInches)
    const heightIn = typeof heightFeet === 'number' || typeof heightInches === 'number'
      ? (heightFeet ?? 0) * 12 + (heightInches ?? 0)
      : null
    const bodyFatPercent = parseNumberInput(profileDraft.bodyFatPercent)
    const age = calculateAge(profileDraft.birthdate)
    const bmi = calculateBmi(weightLb, heightIn)
    const leanMass = typeof weightLb === 'number' && typeof bodyFatPercent === 'number'
      ? weightLb * (1 - bodyFatPercent / 100)
      : null
    const bmr = calculateBmr(weightLb, heightIn, age, profileDraft.sex || null)

    return {
      weightLb,
      heightIn,
      bodyFatPercent,
      age,
      bmi,
      leanMass,
      bmr
    }
  }, [profileDraft])

  const handleProfileChange = (field: keyof ProfileDraft, value: string) => {
    setProfileDraft((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(null)
    const session = await ensureSession()
    if (!session) {
      setProfileSaving(false)
      return
    }
    const sessionUserId = session.user.id

    const weightLb = parseNumberInput(profileDraft.weightLb)
    const heightFeet = parseNumberInput(profileDraft.heightFeet)
    const heightInches = parseNumberInput(profileDraft.heightInches)
    const heightIn = typeof heightFeet === 'number' || typeof heightInches === 'number'
      ? (heightFeet ?? 0) * 12 + (heightInches ?? 0)
      : null
    const bodyFatPercent = parseNumberInput(profileDraft.bodyFatPercent)

    if (bodyFatPercent !== null && (bodyFatPercent < 0 || bodyFatPercent > 70)) {
      setProfileError('Body fat percentage must be between 0 and 70.')
      setProfileSaving(false)
      return
    }
    if (weightLb !== null && weightLb <= 0) {
      setProfileError('Weight must be greater than 0.')
      setProfileSaving(false)
      return
    }
    if (heightIn !== null && heightIn <= 0) {
      setProfileError('Height must be greater than 0.')
      setProfileSaving(false)
      return
    }

    const payload = {
      id: sessionUserId,
      weight_lb: weightLb,
      height_in: heightIn,
      body_fat_percent: bodyFatPercent,
      birthdate: profileDraft.birthdate || null,
      sex: profileDraft.sex || null
    }

    const { data, error: saveError } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('id, height_in, weight_lb, body_fat_percent, birthdate, sex, updated_at')
      .maybeSingle()

    if (saveError) {
      console.error('Failed to save profile', saveError)
      setProfileError('Unable to save profile changes. Please try again.')
    } else {
      const nextHeightIn = typeof data?.height_in === 'number' ? Math.round(data.height_in) : null
      const nextHeightFeet = typeof nextHeightIn === 'number' ? Math.floor(nextHeightIn / 12) : null
      const nextHeightInches = typeof nextHeightIn === 'number' ? nextHeightIn - (nextHeightFeet ?? 0) * 12 : null
      const nextDraft = {
        weightLb: typeof data?.weight_lb === 'number' ? String(data.weight_lb) : '',
        heightFeet: typeof nextHeightFeet === 'number' ? String(nextHeightFeet) : '',
        heightInches: typeof nextHeightInches === 'number' ? String(nextHeightInches) : '',
        bodyFatPercent: typeof data?.body_fat_percent === 'number' ? String(data.body_fat_percent) : '',
        birthdate: data?.birthdate ?? '',
        sex: data?.sex ?? ''
      }
      setProfile(data ? (data as ProfileRow) : null)
      setProfileDraft(nextDraft)
      setProfileSnapshot(JSON.stringify(nextDraft))
      setProfileSuccess('Profile saved.')
    }

    setProfileSaving(false)
  }

  // Settings Handlers
  const persistSettings = async (next: SettingsPreferences) => {
    if (!user) return
    setSaveSettingsState('saving')
    setSaveSettingsError(null)
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
    } catch (saveError) {
      console.error('Failed to save settings preferences', saveError)
      setSaveSettingsState('error')
      setSaveSettingsError('Unable to save settings. Please try again.')
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
      if (typeof error === 'object' && error !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = error as any
        if (err.step) {
          console.error(`Failed at step: ${err.step}`)
        }
        console.error('Error details:', JSON.stringify(error, null, 2))
      }
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
      const measurements = result.measurements ? `, ${result.measurements} body measurements` : ''
      setDevActionMessage(
        `Cleared ${result.templates} templates, ${result.sessions} sessions${readiness}${measurements}.`
      )
      // Re-fetch profile to update local state (especially weight)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('height_in, weight_lb, body_fat_percent, birthdate, sex, updated_at')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profileData) {
        const heightIn = typeof profileData.height_in === 'number' ? Math.round(profileData.height_in) : null
        const heightFeet = typeof heightIn === 'number' ? Math.floor(heightIn / 12) : null
        const heightInches = typeof heightIn === 'number' ? heightIn - (heightFeet ?? 0) * 12 : null
        const nextDraft = {
          weightLb: typeof profileData.weight_lb === 'number' ? String(profileData.weight_lb) : '',
          heightFeet: typeof heightFeet === 'number' ? String(heightFeet) : '',
          heightInches: typeof heightInches === 'number' ? String(heightInches) : '',
          bodyFatPercent: typeof profileData.body_fat_percent === 'number' ? String(profileData.body_fat_percent) : '',
          birthdate: profileData.birthdate ?? '',
          sex: profileData.sex ?? ''
        }
        setProfile(profileData as ProfileRow)
        setProfileDraft(nextDraft)
        setProfileSnapshot(JSON.stringify(nextDraft))
      }
    } catch (error) {
      console.error('Failed to clear dev data', error)
      setDevActionError('Unable to clear dev data. Check the console for details.')
    } finally {
      setDevActionState('idle')
    }
  }

  if (userLoading) {
    return <div className="page-shell p-10 text-center text-muted">Loading profile...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to manage your profile.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-subtle">Profile</p>
          <h1 className="font-display text-3xl font-semibold text-strong" onClick={handleTitleClick}>
            Your personal hub
          </h1>
          <p className="mt-2 text-sm text-muted">
            Keep your body stats and preferences current for smarter recommendations.
          </p>
          {devToolsNotice && <p className="mt-3 text-xs text-muted">{devToolsNotice}</p>}
        </div>

        {(profileError || profileSuccess) && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              profileError
                ? 'alert-error'
                : 'alert-success'
            }`}
          >
            {profileError ?? profileSuccess}
          </div>
        )}

        <Card className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-strong">Personal details</h2>
              <p className="text-sm text-muted">These values power BMI, BMR, and training metrics.</p>
            </div>
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={profileLoading || profileSaving || !profileHasChanges}
            >
              {profileSaving ? 'Saving...' : 'Save profile'}
            </Button>
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              <div className="flex flex-col">
                <label className="text-xs text-subtle">Weight (lb)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={profileDraft.weightLb}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      handleProfileChange('weightLb', val);
                    }
                  }}
                  className="input-base mt-1"
                  disabled={profileLoading || profileSaving}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-subtle">Height</label>
                <div className="mt-1 grid grid-cols-2 gap-2 text-[10px]">
                  <label className="flex flex-col gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="ft"
                      value={profileDraft.heightFeet}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          handleProfileChange('heightFeet', val);
                        }
                      }}
                      className="input-base"
                      disabled={profileLoading || profileSaving}
                    />
                    <span className="text-subtle">Feet</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="in"
                      value={profileDraft.heightInches}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          handleProfileChange('heightInches', val);
                        }
                      }}
                      className="input-base"
                      disabled={profileLoading || profileSaving}
                    />
                    <span className="text-subtle">Inches</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-subtle">Body fat %</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={profileDraft.bodyFatPercent}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      handleProfileChange('bodyFatPercent', val);
                    }
                  }}
                  className="input-base mt-1"
                  disabled={profileLoading || profileSaving}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-subtle">Birthdate</label>
                <input
                  type="date"
                  value={profileDraft.birthdate}
                  onChange={(event) => handleProfileChange('birthdate', event.target.value)}
                  className="input-base mt-1"
                  disabled={profileLoading || profileSaving}
                />
              </div>
              <div className="flex flex-col sm:col-span-2">
                <label className="text-xs text-subtle">Sex (for BMR)</label>
                <select
                  value={profileDraft.sex}
                  onChange={(event) => handleProfileChange('sex', event.target.value)}
                  className="input-base mt-1"
                  disabled={profileLoading || profileSaving}
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non_binary">Non-binary</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-muted">
              <p className="text-[10px] uppercase tracking-wider text-subtle">Profile insights</p>
              <div className="mt-3 space-y-2">
                <p>
                  Weight: <span className="text-strong">{profileMetrics.weightLb ? `${profileMetrics.weightLb} lb` : 'Add weight'}</span>
                </p>
                <p>
                  Height: <span className="text-strong">{profileMetrics.heightIn ? formatHeightFromInches(profileMetrics.heightIn) : 'Add height'}</span>
                </p>
                <p>
                  Age: <span className="text-strong">{typeof profileMetrics.age === 'number' ? `${profileMetrics.age}` : 'Add birthdate'}</span>
                </p>
                <p>
                  BMI: <span className="text-strong">{profileMetrics.bmi ? profileMetrics.bmi.toFixed(1) : 'Add weight + height'}</span>
                </p>
                <p>
                  Lean mass: <span className="text-strong">{profileMetrics.leanMass ? `${Math.round(profileMetrics.leanMass)} lb` : 'Add body fat %'}</span>
                </p>
                <p>
                  Estimated BMR: <span className="text-strong">{profileMetrics.bmr ? `${Math.round(profileMetrics.bmr)} kcal` : 'Add age + sex'}</span>
                </p>
              </div>
            </div>
          </div>
          {profile?.updated_at && (
            <p className="mt-3 text-[10px] text-subtle">Last updated {formatDateTime(profile.updated_at)}</p>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Ruler className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-sm font-semibold text-strong">Units</h2>
                <p className="text-xs text-subtle">Choose your preferred measurement system.</p>
              </div>
            </div>
            {saveSettingsState === 'error' && saveSettingsError && (
              <div className="mt-3 alert-error px-3 py-2 text-xs">{saveSettingsError}</div>
            )}
            {saveSettingsState === 'saved' && <p className="mt-3 text-xs text-muted">Preferences saved.</p>}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Ruler className="h-5 w-5 text-accent" />
                <div>
                  <h2 className="text-sm font-semibold text-strong">Body Weight History</h2>
                  <p className="text-xs text-subtle">Manage independent weight logs.</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingWeightId(null)
                  setManualWeight('')
                  setManualDate(formatDateForInput(new Date()))
                  setIsWeightModalOpen(true)
                }}
              >
                Log Weight
              </Button>
            </div>

            <div className="mt-6">
              <div className="space-y-2">
                {manualLoading ? (
                  <p className="text-xs text-muted">Loading history...</p>
                ) : manualHistory.length === 0 ? (
                  <p className="text-xs text-muted">No manual entries yet.</p>
                ) : (
                  manualHistory.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3 text-xs">
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-strong text-sm">{entry.weight_lb} lb</span>
                        <span className="text-subtle">{formatDate(entry.recorded_at)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-3"
                          onClick={() => handleEditManualWeight(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-3 text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                          onClick={() => handleDeleteManualWeight(entry.id)}
                          disabled={manualDeletingId === entry.id}
                        >
                          {manualDeletingId === entry.id ? '...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          {isWeightModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div className="surface-elevated w-full max-w-sm overflow-hidden flex flex-col p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-strong">{editingWeightId ? 'Edit weight' : 'Log body weight'}</h3>
                  <p className="text-xs text-subtle">Enter your weight and the date recorded.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-subtle">Weight (lb)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={manualWeight}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setManualWeight(val);
                        }
                      }}
                      className="input-base"
                      disabled={manualSaving}
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-subtle">Date</label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="input-base"
                      disabled={manualSaving}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsWeightModalOpen(false)
                      setEditingWeightId(null)
                    }}
                    disabled={manualSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveManualWeight}
                    disabled={manualSaving || !manualWeight || !manualDate}
                  >
                    {manualSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}

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
