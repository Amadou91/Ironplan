'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, X } from 'lucide-react'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TrainingStatusCard } from '@/components/progress/TrainingStatusCard'
import { RecommendedSession } from '@/components/dashboard/RecommendedSession'
import { TemplateInventory } from '@/components/dashboard/TemplateInventory'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { useDashboardData } from '@/hooks/useDashboardData'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelingSession, setCancelingSession] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const {
    user,
    userLoading,
    sessions,
    templates,
    loading,
    error,
    deletingWorkoutIds,
    trainingLoadSummary,
    recommendedTemplateId,
    handleDeleteTemplate
  } = useDashboardData()

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
      endSession()
      setCancelDialogOpen(false)
    } catch (err) {
      console.error('Failed to cancel workout:', err)
      setCancelError('Failed to cancel workout. Please try again.')
    } finally {
      setCancelingSession(false)
    }
  }, [latestActiveSession?.id, supabase, endSession])

  const greetingName = user?.email?.split('@')[0] || 'there'
  const recentSessions = sessions.slice(0, 3)
  const recommendedTemplate = templates.find((template) => template.id === recommendedTemplateId) ?? templates[0]

  if (userLoading || loading) {
    return <div className="page-shell p-10 text-center text-muted">Loading today...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to view your dashboard.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-10 py-4">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-subtle font-bold">Today</p>
            <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-strong mt-2">Welcome back, {greetingName}</h1>
            <p className="mt-3 text-lg text-muted max-w-2xl">Ready to train? We have a smart session queued up for your recovery profile.</p>
          </div>
          <Link href="/generate">
            <Button size="md" className="shadow-lg shadow-[var(--color-primary-soft)]">
              <Sparkles className="h-5 w-5 mr-2" /> Create New Plan
            </Button>
          </Link>
        </div>

        {error && <div className="alert-error p-6 text-base font-medium">{error}</div>}
        {cancelError && <div className="alert-error p-6 text-base font-medium">{cancelError}</div>}

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

        <div className="grid grid-cols-1 gap-12">
          <TrainingStatusCard
            status={trainingLoadSummary.status}
            loadRatio={trainingLoadSummary.loadRatio}
            acuteLoad={trainingLoadSummary.acuteLoad}
            chronicWeeklyAvg={trainingLoadSummary.chronicWeeklyAvg}
            insufficientData={trainingLoadSummary.insufficientData}
            isInitialPhase={trainingLoadSummary.isInitialPhase}
          />

          <RecommendedSession recommendedTemplate={recommendedTemplate} trainingLoadStatus={trainingLoadSummary.status} loadRatio={trainingLoadSummary.loadRatio} />

          <TemplateInventory
            templates={templates}
            recommendedTemplateId={recommendedTemplateId}
            onDeleteTemplate={handleDeleteTemplate}
            deletingWorkoutIds={deletingWorkoutIds}
          />

          <RecentActivity recentSessions={recentSessions} />
        </div>
      </div>
    </div>
  )
}
