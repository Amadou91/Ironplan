'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { 
  calculateAge, 
  calculateBmi, 
  calculateBmr 
} from '@/lib/body-metrics'
import { BodyMetricsForm } from './BodyMetricsForm'
import { WeightHistorySection } from './WeightHistorySection'
import { TrainingGoalsForm } from './TrainingGoalsForm'
import type { Goal, FocusArea } from '@/types/domain'

type ProfileRow = {
  id: string
  height_in: number | null
  weight_lb: number | null
  body_fat_percent: number | null
  birthdate: string | null
  sex: string | null
  updated_at: string | null
  preferences?: any
}

type ProfileDraft = {
  weightLb: string
  heightFeet: string
  heightInches: string
  bodyFatPercent: string
  birthdate: string
  sex: string
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

  // Training Goals State
  const [trainingGoal, setTrainingGoal] = useState<Goal>('hypertrophy')
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(['full_body'])

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
      .select('id, height_in, weight_lb, body_fat_percent, birthdate, sex, updated_at, preferences')
      .eq('id', user.id)
      .maybeSingle()

    if (fetchError) {
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
      
      if (data?.preferences?.trainingGoals) {
        setTrainingGoal(data.preferences.trainingGoals.goal || 'hypertrophy')
        setFocusAreas(data.preferences.trainingGoals.focusAreas || ['full_body'])
      }
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

  const handleProfileChange = (field: string, value: string) => {
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

    const payload = {
      id: user.id,
      weight_lb: weightLb,
      height_in: heightIn,
      body_fat_percent: bodyFatPercent,
      birthdate: profileDraft.birthdate || null,
      sex: profileDraft.sex || null,
      preferences: {
        ...(profile?.preferences || {}),
        trainingGoals: {
          goal: trainingGoal,
          focusAreas
        }
      }
    }

    const { data, error: saveError } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('id, height_in, weight_lb, body_fat_percent, birthdate, sex, updated_at, preferences')
      .maybeSingle()

    if (saveError) {
      onError?.('Unable to save profile changes.')
    } else {
      setProfile(data ? (data as ProfileRow) : null)
      onSuccess?.('Profile saved.')
    }

    setProfileSaving(false)
  }

  const handleSaveManualWeight = async () => {
    if (!user || !manualWeight) return
    const weight = parseFloat(manualWeight)
    if (isNaN(weight) || weight <= 0) return
    
    setManualSaving(true)
    try {
      const recordedAt = manualDate 
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

      setManualWeight('')
      setManualDate(formatDateForInput(new Date()))
      setIsWeightModalOpen(false)
    } catch (err) {
      onError?.('Failed to save weight entry.')
    } finally {
      setManualSaving(false)
    }
  }

  const handleDeleteManualWeight = async (id: string) => {
    if (!confirm('Remove this weight entry?')) return
    setManualDeletingId(id)
    const { error } = await supabase.from('body_measurements').delete().eq('id', id)
    if (!error) {
      setManualHistory(prev => prev.filter(item => item.id !== id))
      onSuccess?.('Entry removed.')
    }
    setManualDeletingId(null)
  }

  return (
    <div className="space-y-8">
      <BodyMetricsForm 
        draft={profileDraft}
        metrics={profileMetrics}
        loading={profileLoading}
        saving={profileSaving}
        hasChanges={profileHasChanges}
        lastUpdated={profile?.updated_at}
        onChange={handleProfileChange}
        onSave={handleSaveProfile}
      />

      <TrainingGoalsForm 
        goal={trainingGoal}
        focusAreas={focusAreas}
        onGoalChange={setTrainingGoal}
        onFocusAreasChange={setFocusAreas}
      />

      <WeightHistorySection 
        history={manualHistory}
        loading={manualLoading}
        deletingId={manualDeletingId}
        onLogNew={() => { setEditingWeightId(null); setManualWeight(''); setManualDate(formatDateForInput(new Date())); setIsWeightModalOpen(true); }}
        onEdit={(entry) => { setEditingWeightId(entry.id); setManualWeight(String(entry.weight_lb)); setManualDate(formatDateForInput(new Date(entry.recorded_at))); setIsWeightModalOpen(true); }}
        onDelete={handleDeleteManualWeight}
      />

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
                <input type="text" inputMode="decimal" placeholder="0.0" value={manualWeight} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setManualWeight(val); }} className="input-base" disabled={manualSaving} autoFocus />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-subtle">Date</label>
                <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="input-base" disabled={manualSaving} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsWeightModalOpen(false)} disabled={manualSaving}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveManualWeight} disabled={manualSaving || !manualWeight || !manualDate}>
                {manualSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}