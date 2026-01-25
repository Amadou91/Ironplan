'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles } from 'lucide-react'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TrainingStatusCard } from '@/components/progress/TrainingStatusCard'
import { RecommendedSession } from '@/components/dashboard/RecommendedSession'
import { TemplateInventory } from '@/components/dashboard/TemplateInventory'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { useDashboardData } from '@/hooks/useDashboardData'

export default function DashboardPage() {
  const router = useRouter()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const {
    user,
    userLoading,
    sessions,
    templates,
    loading,
    error,
    deletingWorkoutIds,
    templateById,
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
    ? `/workouts/${latestActiveSession.templateId}/active?sessionId=${latestActiveSession.id}&from=dashboard`
    : latestActiveSession?.id
      ? `/workouts/active?sessionId=${latestActiveSession.id}&from=dashboard`
      : '/dashboard'

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
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-subtle">Today</p>
            <h1 className="font-display text-3xl font-semibold text-strong">Welcome back, {greetingName}</h1>
            <p className="mt-2 text-sm text-muted">Ready to train? We have a smart session queued up.</p>
          </div>
          <Link href="/generate">
            <Button variant="secondary" size="sm">
              <Sparkles className="h-4 w-4 mr-2" /> New Plan
            </Button>
          </Link>
        </div>

        {error && <div className="alert-error p-4 text-sm">{error}</div>}

        {latestActiveSession && (
          <Card className="p-6 border-[var(--color-primary-border)] bg-[var(--color-primary-soft)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-primary-strong)]">Session in progress</p>
                <p className="text-xs text-subtle">Finish your active session before starting another.</p>
              </div>
              <Link href={resumeLink}>
                <Button variant="secondary" size="sm">
                  Resume session
                </Button>
              </Link>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-8">
          <RecommendedSession recommendedTemplate={recommendedTemplate} trainingLoadStatus={trainingLoadSummary.status} />

          <TemplateInventory
            templates={templates}
            recommendedTemplateId={recommendedTemplateId}
            onDeleteTemplate={handleDeleteTemplate}
            deletingWorkoutIds={deletingWorkoutIds}
          />

          <RecentActivity recentSessions={recentSessions} templateById={templateById} />

          <TrainingStatusCard
            status={trainingLoadSummary.status}
            loadRatio={trainingLoadSummary.loadRatio}
            weeklyLoad={trainingLoadSummary.acuteLoad}
            chronicWeeklyAvg={trainingLoadSummary.chronicWeeklyAvg}
            insufficientData={trainingLoadSummary.insufficientData}
            isInitialPhase={trainingLoadSummary.isInitialPhase}
          />
        </div>
      </div>
    </div>
  )
}