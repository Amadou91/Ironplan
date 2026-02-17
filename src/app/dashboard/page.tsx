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
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
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
          eyebrow="Today"
          title={`Welcome back, ${greetingName}`}
          description="Ready to train? We have a smart session queued up for your recovery profile."
          actions={
            <Link href="/generate">
              <Button size="md" className="shadow-lg shadow-[var(--color-primary-soft)]">
                <Sparkles className="h-5 w-5 mr-2" /> Create new plan
              </Button>
            </Link>
          }
        />

        {error ? <Alert variant="error">{error}</Alert> : null}
        {cancelError ? <Alert variant="error">{cancelError}</Alert> : null}

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
