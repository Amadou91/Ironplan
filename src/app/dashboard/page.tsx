'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { ProfileCompletionBanner } from '@/components/dashboard/ProfileCompletionBanner'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useWorkoutSuggestion } from '@/hooks/useWorkoutSuggestion'
import type { WorkoutSuggestion } from '@/lib/suggestion-logic'
import type { SessionRow } from '@/lib/transformers/progress-data'

const SessionSetupModal = dynamic(
  () => import('@/components/dashboard/SessionSetupModal').then((mod) => mod.SessionSetupModal),
  { ssr: false }
)

const SuggestionModal = dynamic(
  () => import('@/components/dashboard/SuggestionModal').then((mod) => mod.SuggestionModal),
  { ssr: false }
)

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabase()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelingSession, setCancelingSession] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  
  const [quickStartOpen, setQuickStartOpen] = useState(false)
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<WorkoutSuggestion | null>(null)
  const quickStartRequested = searchParams.get('quickStart') === '1'

  const {
    user,
    userLoading,
    sessions,
    loading,
    error,
    trainingLoadSummary,
    refresh
  } = useDashboardData()

  // Always compute suggestion, but only show it when requested
  const currentSuggestion = useWorkoutSuggestion(sessions as unknown as SessionRow[])

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

  const handleBeginWorkout = () => {
    // If we have a valid suggestion, show it first
    if (currentSuggestion) {
      setSuggestionModalOpen(true)
    } else {
      // Fallback directly to setup if no suggestion available
      setQuickStartOpen(true)
    }
  }

  const handleAcceptSuggestion = (suggestion: WorkoutSuggestion) => {
    setSelectedSuggestion(suggestion)
    setSuggestionModalOpen(false)
    setQuickStartOpen(true)
  }

  const handleCustomizeSession = () => {
    setSelectedSuggestion(null)
    setSuggestionModalOpen(false)
    setQuickStartOpen(true)
  }

  const greetingName = user?.email?.split('@')[0] || 'there'
  const recentSessions = sessions.slice(0, 3)

  useEffect(() => {
    if (!quickStartRequested) return
    setQuickStartOpen(true)
  }, [quickStartRequested])

  const closeQuickStart = useCallback(() => {
    setQuickStartOpen(false)
    setSelectedSuggestion(null)
    if (quickStartRequested) {
      router.replace('/dashboard')
    }
  }, [quickStartRequested, router])
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
            <Button size="md" className="w-full shadow-lg shadow-[var(--color-primary-soft)] sm:w-auto" onClick={handleBeginWorkout}>
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
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-nowrap">
                <Button 
                  variant="ghost" 
                  size="md" 
                  className="min-h-11"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={cancelingSession}
                >
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Link href={resumeLink} className="w-full sm:w-auto">
                  <Button variant="primary" size="md" className="w-full min-h-11">
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
          <TrainingStatusCard
            status={trainingLoadSummary.status}
            loadRatio={trainingLoadSummary.loadRatio}
            acuteLoad={trainingLoadSummary.acuteLoad}
            chronicWeeklyAvg={trainingLoadSummary.chronicWeeklyAvg}
            insufficientData={trainingLoadSummary.insufficientData}
            isInitialPhase={trainingLoadSummary.isInitialPhase}
          />

          <RecentActivity recentSessions={recentSessions} />
        </div>

        <SuggestionModal 
          isOpen={suggestionModalOpen}
          onClose={() => setSuggestionModalOpen(false)}
          suggestion={currentSuggestion}
          onConfirm={handleAcceptSuggestion}
          onCustomize={handleCustomizeSession}
        />

        <SessionSetupModal
          isOpen={quickStartOpen}
          onClose={closeQuickStart}
          templateTitle={selectedSuggestion ? "Suggested Workout" : "Begin Workout"}
          templateStyle={selectedSuggestion?.goal || "hypertrophy"}
          initialFocusAreas={selectedSuggestion?.focus}
          templateIntensity={selectedSuggestion?.intensity}
        />
      </div>
    </div>
  )
}
