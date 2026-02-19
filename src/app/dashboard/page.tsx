'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, X } from 'lucide-react'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useSupabase } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { TrainingStatusCard } from '@/components/progress/TrainingStatusCard'
import { SessionSetupModal } from '@/components/dashboard/SessionSetupModal'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { ProfileCompletionBanner } from '@/components/dashboard/ProfileCompletionBanner'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useAcrVisibility } from '@/hooks/useAcrVisibility'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelingSession, setCancelingSession] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [quickStartOpen, setQuickStartOpen] = useState(false)
  const {
    user,
    userLoading,
    sessions,
    loading,
    error,
    trainingLoadSummary,
    refresh
  } = useDashboardData()
  const acrVisibility = useAcrVisibility()
  const showAcrOnDashboard = acrVisibility === 'dashboard' || acrVisibility === 'both'

  const latestActiveSession = useMemo(() => {
    if (activeSession) return activeSession
    const found = sessions.find((s) => s.status === 'in_progress')
    if (found) {
      return {
        id: found.id,
        name: found.name,
        templateId: found.template_id,
        startedAt: found.started_at
      }
    }
    return null
  }, [activeSession, sessions])

  const resumeLink = latestActiveSession?.templateId
    ? `/exercises/${latestActiveSession.templateId}/active?sessionId=${latestActiveSession.id}&from=dashboard`
    : latestActiveSession?.id
      ? `/exercises/active?sessionId=${latestActiveSession.id}&from=dashboard`
      : '/dashboard'

  const handleCancelSession = useCallback(async () => {
    if (!latestActiveSession?.id) return
    setCancelError(null)
    setCancelingSession(true)
    try {
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          status: 'cancelled',
          ended_at: new Date().toISOString()
        })
        .eq('id', latestActiveSession.id)

      if (updateError) throw updateError
      // Clear the Zustand store immediately so the UI reacts without waiting
      endSession()
      setCancelDialogOpen(false)
      // Re-fetch sessions so the stale in_progress entry is removed from
      // the sessions list that latestActiveSession also reads from.
      await refresh()
    } catch (err) {
      console.error('Failed to cancel workout:', err)
      setCancelError('Failed to cancel workout. Please try again.')
    } finally {
      setCancelingSession(false)
    }
  }, [latestActiveSession?.id, supabase, endSession, refresh])

  const greetingName = user?.email?.split('@')[0] || 'there'
  const recentSessions = sessions.slice(0, 3)
  if (userLoading || loading) {
    return (
      <div className="page-shell">
        <div className="page-stack">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-shell page-stack">
        <EmptyState
          title="Sign in to view your dashboard"
          description="Get your training status, active session, and recommendations in one place."
          action={<Button onClick={() => router.push('/auth/login')}>Sign in</Button>}
        />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-stack">
        <PageHeader
          eyebrow="Dashboard"
          title={`Welcome back, ${greetingName}`}
          actions={
            <Button size="md" className="shadow-lg shadow-[var(--color-primary-soft)]" onClick={() => setQuickStartOpen(true)}>
              <Sparkles className="h-5 w-5 mr-2" /> Begin Workout
            </Button>
          }
        />

        {error ? <Alert variant="error">{error}</Alert> : null}
        {cancelError ? <Alert variant="error">{cancelError}</Alert> : null}

        <ProfileCompletionBanner />

        {latestActiveSession && (
          <Card className="p-8 border-2 border-[var(--color-primary-border)] bg-[var(--color-primary-soft)]/50 backdrop-blur-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-[var(--color-primary-strong)]">Session in progress</p>
                <p className="text-sm text-subtle font-medium">Finish your active session before starting another.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="md" 
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={cancelingSession}
                >
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Link href={resumeLink}>
                  <Button variant="primary" size="md">
                    Resume active session
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        <ConfirmDialog
          isOpen={cancelDialogOpen}
          onClose={() => setCancelDialogOpen(false)}
          onConfirm={handleCancelSession}
          title="Cancel Workout"
          description="Are you sure you want to cancel this workout session? All logged sets will be discarded and cannot be recovered."
          confirmText={cancelingSession ? 'Cancelling...' : 'Cancel Workout'}
          cancelText="Keep Session"
          variant="danger"
          isLoading={cancelingSession}
        />

        <div className="grid grid-cols-1 gap-8">
          {showAcrOnDashboard && (
            <TrainingStatusCard
              status={trainingLoadSummary.status}
              loadRatio={trainingLoadSummary.loadRatio}
              acuteLoad={trainingLoadSummary.acuteLoad}
              chronicWeeklyAvg={trainingLoadSummary.chronicWeeklyAvg}
              insufficientData={trainingLoadSummary.insufficientData}
              isInitialPhase={trainingLoadSummary.isInitialPhase}
            />
          )}

          <RecentActivity recentSessions={recentSessions} />
        </div>

        <SessionSetupModal
          isOpen={quickStartOpen}
          onClose={() => setQuickStartOpen(false)}
          templateTitle="Begin Workout"
          templateStyle="hypertrophy"
          initialFocusAreas={['chest']}
        />
      </div>
    </div>
  )
}
