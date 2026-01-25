'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { TrainingStatusCard } from '@/components/progress/TrainingStatusCard'
import { ProgressFilters } from '@/components/progress/ProgressFilters'
import { SessionHistoryList } from '@/components/progress/SessionHistoryList'
import { MetricCards } from '@/components/progress/MetricCards'
import { ProgressCharts } from '@/components/progress/ProgressCharts'
import { useProgressMetrics } from '@/hooks/useProgressMetrics'
import { createClient } from '@/lib/supabase/client'

export default function ProgressPage() {
  const router = useRouter()
  const supabase = createClient()
  const {
    user, userLoading, loading, error, setError, setSessions, filteredSessions,
    templateById, exerciseOptions, startDate, setStartDate, endDate, setEndDate,
    selectedMuscle, setSelectedMuscle, selectedExercise, setSelectedExercise,
    hasMoreSessions, setSessionPage, trainingLoadSummary, aggregateMetrics,
    prMetrics, readinessAverages, readinessSeries, readinessComponents,
    readinessCorrelation, readinessTrendLine, volumeTrend, effortTrend,
    exerciseTrend, muscleBreakdown, bodyWeightData, sessionsPerWeek,
    getSessionTitle, exerciseLibraryByName, ensureSession
  } = useProgressMetrics()

  const [creatingManualSession, setCreatingManualSession] = useState(false)

  const handleCreateManualSession = useCallback(async () => {
    setCreatingManualSession(true); setError(null)
    const session = await ensureSession()
    if (!session) { setCreatingManualSession(false); return }
    try {
      const now = new Date()
      const { data, error: insertError } = await supabase.from('sessions').insert({
        user_id: session.user.id, name: 'Manual workout', status: 'completed',
        started_at: now.toISOString(), ended_at: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
      }).select('id').single()
      if (insertError || !data) throw insertError ?? new Error('Failed to create manual session.')
      router.push(`/sessions/${data.id}/edit`)
    } catch { setError('Unable to create a manual session.') } finally { setCreatingManualSession(false) }
  }, [ensureSession, router, supabase, setError])

  if (userLoading || loading) return (
    <div className="page-shell"><div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16 animate-pulse">
      <div className="h-20 w-full rounded bg-[var(--color-surface-muted)]" />
      <div className="h-[300px] w-full rounded bg-[var(--color-surface-muted)]" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded bg-[var(--color-surface-muted)]" />)}</div>
    </div></div>
  )

  if (!user) return <div className="page-shell p-10 text-center text-muted"><p className="mb-4">Sign in to view your progress.</p><Button onClick={() => router.push('/auth/login')}>Sign in</Button></div>

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs uppercase tracking-[0.3em] text-subtle">Progress</p><h1 className="font-display text-3xl font-semibold text-strong">Progress and insights</h1></div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCreateManualSession} disabled={creatingManualSession}>{creatingManualSession ? 'Creating...' : 'Log past workout'}</Button>
            <Button variant="secondary" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setSelectedMuscle('all'); setSelectedExercise('all'); }}>Reset filters</Button>
          </div>
        </div>
        {error && <div className="alert-error p-4 text-sm">{error}</div>}
        <TrainingStatusCard {...trainingLoadSummary} />
        <ProgressFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedMuscle={selectedMuscle} setSelectedMuscle={setSelectedMuscle} selectedExercise={selectedExercise} setSelectedExercise={setSelectedExercise} exerciseOptions={exerciseOptions} muscleBreakdown={muscleBreakdown} />
        <MetricCards prMetrics={prMetrics} aggregateMetrics={aggregateMetrics} readinessAverages={readinessAverages} sessionCount={filteredSessions.length} sessionsPerWeek={sessionsPerWeek} />
        <ProgressCharts volumeTrend={volumeTrend} effortTrend={effortTrend} exerciseTrend={exerciseTrend} bodyWeightData={bodyWeightData} readinessSeries={readinessSeries} readinessComponents={readinessComponents} readinessCorrelation={readinessCorrelation} readinessTrendLine={readinessTrendLine} />
        <SessionHistoryList sessions={filteredSessions} templateById={templateById} exerciseLibraryByName={exerciseLibraryByName} getSessionTitle={getSessionTitle} hasMore={hasMoreSessions} onLoadMore={() => setSessionPage(p => p + 1)} onDeleteSuccess={(id) => setSessions(prev => prev.filter(s => s.id !== id))} onError={setError} loading={loading} />
      </div>
    </div>
  )
}