'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Ruler } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { 
  calculateAge, 
  calculateBmi, 
  calculateBmr, 
  formatHeightFromInches 
} from '@/lib/body-metrics'

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

interface PhysicalStatsFormProps {
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

export function PhysicalStatsForm({ onSuccess, onError }: PhysicalStatsFormProps) {
  const supabase = createClient()
  const { user } = useUser()
  
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

  // Manual Weight State
  const [manualWeight, setManualWeight] = useState('')
  const [manualDate, setManualDate] = useState(formatDateForInput(new Date()))
  const [manualHistory, setManualHistory] = useState<Array<{ id: string; weight_lb: number; recorded_at: string }>>([])
  const [manualLoading, setManualLoading] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualDeletingId, setManualDeletingId] = useState<string | null>(null)
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false)
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setProfileLoading(true)
    
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('id, height_in, weight_lb, body_fat_percent, birthdate, sex, updated_at')
      .eq('id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('Failed to load profile data', fetchError)
      onError?.('Unable to load your profile data.')
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
  }, [user, supabase, onError])

  const loadManualHistory = useCallback(async () => {
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
  }, [user, supabase])

  useEffect(() => {
    loadData()
    loadManualHistory()
  }, [loadData, loadManualHistory])

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
    
    const { weightLb, heightIn, bodyFatPercent } = profileMetrics

    if (bodyFatPercent !== null && (bodyFatPercent < 0 || bodyFatPercent > 70)) {
      onError?.('Body fat percentage must be between 0 and 70.')
      setProfileSaving(false)
      return
    }
    if (weightLb !== null && weightLb <= 0) {
      onError?.('Weight must be greater than 0.')
      setProfileSaving(false)
      return
    }
    if (heightIn !== null && heightIn <= 0) {
      onError?.('Height must be greater than 0.')
      setProfileSaving(false)
      return
    }

    const payload = {
      id: user.id,
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
      onError?.('Unable to save profile changes.')
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
      onSuccess?.('Profile saved.')
    }

    setProfileSaving(false)
  }

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
      const recordedAt = manualDate 
      
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
          setManualHistory(prev => prev.map(item => item.id === editingWeightId ? data : item).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)))
          onSuccess?.('Weight entry updated.')
        }
      } else {
        const { data, error } = await supabase
          .from('body_measurements')
          .upsert({
            user_id: user.id,
            weight_lb: weight,
            recorded_at: recordedAt,
            source: 'user'
          }, { onConflict: 'user_id,recorded_at,source' })
          .select('id, weight_lb, recorded_at')
          .single()
        
        if (!error && data) {
          setManualHistory(prev => {
            const filtered = prev.filter(item => item.recorded_at !== recordedAt)
            return [data, ...filtered].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).slice(0, 20)
          })
          onSuccess?.('Weight logged.')
        }
      }

      // Update profile with latest weight
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
      onError?.('Failed to save weight entry.')
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
        onSuccess?.('Entry removed.')
      }
    } catch (err) {
      console.error('Failed to delete weight entry', err)
      onError?.('Failed to delete weight entry.')
    } finally {
      setManualDeletingId(null)
    }
  }

  return (
    <div className="space-y-8">
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
    </div>
  )
}
