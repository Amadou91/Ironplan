'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

import { useSupabase } from '@/hooks/useSupabase'

import { useUser } from '@/hooks/useUser'

import { 

  calculateAge, 

  calculateBmi, 

  calculateBmr 

} from '@/lib/body-metrics'

import { BodyMetricsForm } from '@/components/profile/BodyMetricsForm'

import { WeightHistorySection } from '@/components/profile/WeightHistorySection'

import { WeightLogModal } from '@/components/profile/WeightLogModal'

import { useUIStore } from '@/store/uiStore'

import { KG_PER_LB, LBS_PER_KG } from '@/lib/units'



type ProfileRow = {

  id: string

  height_in: number | null

  weight_lb: number | null

  body_fat_percent: number | null

  birthdate: string | null

  sex: string | null

  updated_at: string | null

  preferences?: Record<string, unknown> | null

}



type ProfileDraft = {

  weightLb: string

  heightFeet: string

  heightInches: string

  bodyFatPercent: string

  birthdate: string

  sex: string

}

import { formatDateForInput } from '@/lib/date-utils'


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

  const supabase = useSupabase()

  const { user } = useUser()

  const { displayUnit } = useUIStore()

  const isKg = displayUnit === 'kg'

  

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

  /** Becomes true after the first successful DB fetch so we don't flash required indicators on mount */
  const [profileLoaded, setProfileLoaded] = useState(false)


  // Manual Weight State

  const [manualWeight, setManualWeight] = useState('')

  const [manualDate, setManualDate] = useState(formatDateForInput(getNowET()))

  const [manualHistory, setManualHistory] = useState<Array<{ id: string; weight_lb: number; recorded_at: string; source: string; session_id: string | null }>>([])

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

      

      const displayWeight = typeof data?.weight_lb === 'number' 

        ? isKg ? Math.round(data.weight_lb * KG_PER_LB * 10) / 10 : data.weight_lb

        : ''



      const nextDraft = {

        weightLb: String(displayWeight),

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

    setProfileLoaded(true)

  }, [user, supabase, onError, isKg])



  const loadManualHistory = useCallback(async () => {

    if (!user) return

    setManualLoading(true)

    const { data, error } = await supabase

      .from('body_measurements')

      .select('id, weight_lb, recorded_at, source, session_id')

      .eq('user_id', user.id)

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



  /**
   * Keys of required fields that are still empty after the initial load.
   * Only populated once profileLoaded is true so no false-positive highlights
   * flash before the DB query completes.
   */
  const missingFieldKeys = useMemo(() => {

    if (!profileLoaded) return []

    const missing: string[] = []

    const rawWeight = parseNumberInput(profileDraft.weightLb)

    if (typeof rawWeight !== 'number' || rawWeight <= 0) missing.push('weight_lb')



    const feet = parseNumberInput(profileDraft.heightFeet) ?? 0

    const inches = parseNumberInput(profileDraft.heightInches) ?? 0

    if (feet * 12 + inches <= 0) missing.push('height_in')



    if (!profileDraft.birthdate) missing.push('birthdate')

    if (!profileDraft.sex) missing.push('sex')



    return missing

  }, [profileLoaded, profileDraft])



  const profileMetrics = useMemo(() => {

    const rawWeight = parseNumberInput(profileDraft.weightLb)

    const weightLb = typeof rawWeight === 'number'

      ? isKg ? rawWeight * LBS_PER_KG : rawWeight

      : null



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

  }, [profileDraft, isKg])



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

      preferences: profile?.preferences || {}

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
          
          // Also record measurement in history if weight was changed
          if (weightLb) {
            const { recordBodyWeight } = await import('@/lib/body-measurements')
            await recordBodyWeight({
              supabase,
              userId: user.id,
              weightLb,
              source: 'user'
            })
            await loadManualHistory()
          }
          
          onSuccess?.('Profile saved.')
        }
    



    setProfileSaving(false)

  }



  const handleSaveManualWeight = async () => {

    if (!user || !manualWeight) return

    const rawWeight = parseFloat(manualWeight)

    if (isNaN(rawWeight) || rawWeight <= 0) return

    

        setManualSaving(true)
        try {
          const weightLb = isKg ? rawWeight * LBS_PER_KG : rawWeight
          const recordedAt = manualDate 
          
          const { recordBodyWeight } = await import('@/lib/body-measurements')
          const result = await recordBodyWeight({
            supabase,
            userId: user.id,
            weightLb,
            date: recordedAt,
            source: 'user'
          })
          
          if (result.success) {
            // Refresh history to show the update/new entry
            await loadManualHistory()
            onSuccess?.('Weight logged.')
          } else {
            throw new Error(result.error)
          }
    



      setManualWeight('')

      setManualDate(formatDateForInput(getNowET()))

      setIsWeightModalOpen(false)

    } catch {

      onError?.('Failed to save weight entry.')

    } finally {

      setManualSaving(false)

    }

  }



  const handleDeleteManualWeight = async (id: string) => {

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

        missingFieldKeys={missingFieldKeys}

        onChange={handleProfileChange}

        onSave={handleSaveProfile}

      />



      <WeightHistorySection 

        history={manualHistory}

        loading={manualLoading}

        deletingId={manualDeletingId}

        onLogNew={() => { setEditingWeightId(null); setManualWeight(''); setManualDate(formatDateForInput(getNowET())); setIsWeightModalOpen(true); }}

        onEdit={(entry) => { 

          setEditingWeightId(entry.id); 

          const displayVal = isKg ? Math.round(entry.weight_lb * KG_PER_LB * 10) / 10 : entry.weight_lb;

          setManualWeight(String(displayVal)); 

          setManualDate(formatDateForInput(new Date(entry.recorded_at))); 

          setIsWeightModalOpen(true); 

        }}

        onDelete={handleDeleteManualWeight}

      />



      <WeightLogModal
        isOpen={isWeightModalOpen}
        isEditing={!!editingWeightId}
        weight={manualWeight}
        date={manualDate}
        saving={manualSaving}
        displayUnit={displayUnit}
        onWeightChange={setManualWeight}
        onDateChange={setManualDate}
        onSave={handleSaveManualWeight}
        onClose={() => setIsWeightModalOpen(false)}
      />
    </div>
  )
}
