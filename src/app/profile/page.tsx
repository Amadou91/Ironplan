'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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

  const ensureSession = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !data.session) {
      setUser(null)
      setProfileError('Your session has expired. Please sign in again.')
      return null
    }
    return data.session
  }, [setUser, supabase])

  useEffect(() => {
    if (userLoading) return
    if (!user) return

    const loadProfile = async () => {
      setProfileLoading(true)
      setProfileError(null)
      setProfileSuccess(null)
      const session = await ensureSession()
      if (!session) {
        setProfileLoading(false)
        return
      }
      const sessionUserId = session.user.id
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, height_in, weight_lb, body_fat_percent, birthdate, sex, updated_at')
        .eq('id', sessionUserId)
        .maybeSingle()

      if (profileError) {
        console.error('Failed to load profile', profileError, profileError.message, profileError.details, profileError.hint)
        const message = profileError.message?.includes('permission')
          ? 'Profile access is blocked by permissions. Apply the profiles policies/grants migrations.'
          : profileError.message?.includes('relation')
            ? 'Profiles table is missing. Apply the profiles migrations.'
            : 'Unable to load your profile. Please try again.'
        setProfileError(message)
      } else {
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
      }
      setProfileLoading(false)
    }

    loadProfile()
  }, [ensureSession, supabase, user, userLoading])

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
      console.error('Failed to save profile', saveError, saveError.message, saveError.details, saveError.hint)
      const message = saveError.message?.includes('permission')
        ? 'Profile access is blocked by permissions. Apply the profiles policies/grants migrations.'
        : saveError.message?.includes('relation')
          ? 'Profiles table is missing. Apply the profiles migrations.'
          : 'Unable to save profile changes. Please try again.'
      setProfileError(message)
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
          <h1 className="font-display text-3xl font-semibold text-strong">Your personal hub</h1>
          <p className="mt-2 text-sm text-muted">
            Keep your body stats and preferences current for smarter recommendations.
          </p>
        </div>

        {(profileError || profileSuccess) && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              profileError
                ? 'alert-error'
                : 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
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
                  type="number"
                  min={0}
                  value={profileDraft.weightLb}
                  onChange={(event) => handleProfileChange('weightLb', event.target.value)}
                  className="input-base mt-1"
                  disabled={profileLoading || profileSaving}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-subtle">Height</label>
                <div className="mt-1 grid grid-cols-2 gap-2 text-[10px]">
                  <label className="flex flex-col gap-1">
                    <input
                      type="number"
                      min={0}
                      placeholder="ft"
                      value={profileDraft.heightFeet}
                      onChange={(event) => handleProfileChange('heightFeet', event.target.value)}
                      className="input-base"
                      disabled={profileLoading || profileSaving}
                    />
                    <span className="text-subtle">Feet</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <input
                      type="number"
                      min={0}
                      max={11}
                      placeholder="in"
                      value={profileDraft.heightInches}
                      onChange={(event) => handleProfileChange('heightInches', event.target.value)}
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
                  type="number"
                  min={0}
                  max={70}
                  value={profileDraft.bodyFatPercent}
                  onChange={(event) => handleProfileChange('bodyFatPercent', event.target.value)}
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
            <h3 className="text-sm font-semibold text-strong">Achievements</h3>
            <ul className="mt-3 space-y-2 text-xs text-muted">
              <li className="rounded-lg border border-[var(--color-border)] px-3 py-2">Complete your first session</li>
              <li className="rounded-lg border border-[var(--color-border)] px-3 py-2">Maintain a 2-week streak</li>
              <li className="rounded-lg border border-[var(--color-border)] px-3 py-2">Hit a new personal best</li>
            </ul>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-strong">Preferences</h3>
            <p className="mt-2 text-sm text-muted">
              Manage your measurement units and core preferences.
            </p>
            <Link href="/settings" className="mt-3 inline-flex text-sm font-semibold text-accent">
              Open settings
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
