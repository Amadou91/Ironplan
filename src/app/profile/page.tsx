'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { useSupabase } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ProfileSection } from '@/components/profile/ProfileSection'
import { PhysicalStatsForm } from '@/components/profile/PhysicalStatsForm'
import { AppSettings } from '@/components/profile/AppSettings'
import { EquipmentSettingsForm } from '@/components/profile/EquipmentSettingsForm'
import { DeveloperToolsPanel } from '@/components/profile/DeveloperToolsPanel'
import { normalizePreferences } from '@/lib/preferences'
import { isDeveloperToolsUser } from '@/lib/developer-access'
import { validateProfileCompletion, type ProfileSnapshot } from '@/lib/profile-validation'
import { useStrengthMetrics } from '@/hooks/useStrengthMetrics'

const SessionHistoryList = dynamic(
  () => import('@/components/progress/SessionHistoryList').then((mod) => mod.SessionHistoryList),
  {
    loading: () => <Skeleton className="h-[28rem] w-full" />
  }
)

/** Per-section missing-field counts. null = not yet loaded. */
type SectionCompletion = { metrics: number | null; equipment: number | null }

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useSupabase()
  const { user, loading: userLoading } = useUser()

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [completion, setCompletion] = useState<SectionCompletion>({ metrics: null, equipment: null })
  const {
    sessions: historySessions,
    setSessions: setHistorySessions,
    setSessionPage: setHistorySessionPage,
    hasMoreSessions: historyHasMore,
    getSessionTitle: getHistorySessionTitle,
    exerciseLibraryByName: historyExerciseLibraryByName,
    loading: historyLoading
  } = useStrengthMetrics()

  const devToolsEnabled = isDeveloperToolsUser(user?.email)

  /**
   * Lightweight query to derive per-section completion badges.
   * Re-runs after each section saves so badges stay up to date.
   */
  const fetchCompletionData = useCallback(async (): Promise<SectionCompletion | null> => {
    if (!user) return null
    const { data } = await supabase
      .from('profiles')
      .select('weight_lb, height_in, birthdate, sex, preferences')
      .eq('id', user.id)
      .maybeSingle()

    const prefs = normalizePreferences(data?.preferences)
    const inv = prefs.equipment?.inventory
    const hasEquipment = inv
      ? Object.entries(inv).some(([key, v]) => {
          if (key === 'machines') return Object.values(v as Record<string, boolean>).some(Boolean)
          if (Array.isArray(v)) return (v as unknown[]).length > 0
          if (key === 'barbell') return (v as { available: boolean }).available
          return Boolean(v)
        })
      : false

    const snapshot: ProfileSnapshot = {
      weight_lb: data?.weight_lb,
      height_in: data?.height_in,
      birthdate: data?.birthdate,
      sex: data?.sex,
      hasEquipment,
    }
    const result = validateProfileCompletion(snapshot)
    const metricKeys = new Set(['weight_lb', 'height_in', 'birthdate', 'sex'])
    const metricsMissing = result.missingFields.filter((f) => metricKeys.has(f.key)).length
    const equipmentMissing = result.missingFields.filter((f) => f.key === 'hasEquipment').length
    return { metrics: metricsMissing, equipment: equipmentMissing }
  }, [user, supabase])

  useEffect(() => {
    if (!userLoading && user) {
      fetchCompletionData().then(result => {
        if (result) setCompletion(result)
      })
    }
  }, [user, userLoading, fetchCompletionData])

  const handleSuccess = (msg: string) => {
    setSuccess(msg)
    setError(null)
    fetchCompletionData().then(result => {
      if (result) setCompletion(result)
    })
    setTimeout(() => setSuccess(null), 3000)
  }
  const handleError = (msg: string) => {
    setError(msg)
    setSuccess(null)
    setTimeout(() => setError(null), 5000)
  }
  const handleImportSuccess = useCallback(() => {
    setHistorySessions([])
    setHistorySessionPage(0)
  }, [setHistorySessions, setHistorySessionPage])

  if (userLoading) {
    return (
      <div className="page-shell page-stack">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-shell page-stack">
        <EmptyState
          title="Sign in to manage your profile"
          description="Access your physical stats, app preferences, and training metrics settings."
          action={<Button onClick={() => router.push('/auth/login')}>Sign in</Button>}
        />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-stack">
        <PageHeader eyebrow="Account" title="Profile & Settings" />
        <ProfileHeader user={user} />

        {error ? <Alert variant="error">{error}</Alert> : null}
        {!error && success ? <Alert variant="success">{success}</Alert> : null}

        <div className="flex flex-col gap-3">
          <ProfileSection
            title="User Preferences"
            description="Units, display, and training preferences."
            missingCount={0}
            defaultOpen={false}
          >
            <AppSettings onSuccess={handleSuccess} onError={handleError} />
          </ProfileSection>

          <ProfileSection
            title="Body metrics"
            description="Weight, height, and body composition."
            missingCount={completion.metrics ?? undefined}
            defaultOpen={false}
          >
            <PhysicalStatsForm onSuccess={handleSuccess} onError={handleError} />
          </ProfileSection>

          <ProfileSection
            title="Workout equipment"
            description="Equipment defaults used for workout generation."
            missingCount={completion.equipment ?? undefined}
            defaultOpen={false}
          >
            <EquipmentSettingsForm onSuccess={handleSuccess} onError={handleError} />
          </ProfileSection>

          <ProfileSection
            title="Previous sessions"
            description="Session history, edits, and imports."
            defaultOpen={false}
          >
            <SessionHistoryList
              sessions={historySessions}
              exerciseLibraryByName={historyExerciseLibraryByName}
              getSessionTitle={getHistorySessionTitle}
              hasMore={historyHasMore}
              onLoadMore={() => setHistorySessionPage((p) => p + 1)}
              onDeleteSuccess={(id) => setHistorySessions((prev) => prev.filter((s) => s.id !== id))}
              onError={handleError}
              loading={historyLoading}
              onImportSuccess={handleImportSuccess}
              embedded
            />
          </ProfileSection>

          {devToolsEnabled ? (
            <ProfileSection
              title="Developer tools"
              description="Seed data and debug utilities."
              defaultOpen={false}
            >
              <DeveloperToolsPanel onSuccess={handleSuccess} onError={handleError} />
            </ProfileSection>
          ) : null}
        </div>
      </div>
    </div>
  )
}
