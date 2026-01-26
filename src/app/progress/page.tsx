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
    user, userLoading, loading, error, setError, sessions, setSessions, filteredSessions,
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

  // Only show full page skeleton on initial load or when we have no data
  const isInitialLoad = userLoading || (loading && sessions.length === 0)

  if (isInitialLoad) return (
    <div className="page-shell">
      <div className="w-full space-y-10 py-4 animate-pulse">
        <div className="h-32 w-full rounded-xl bg-[var(--color-surface-muted)]" />
        <div className="grid grid-cols-1 gap-12">
          <div className="h-48 w-full rounded-xl bg-[var(--color-surface-muted)]" />
          <div className="h-16 w-full rounded-xl bg-[var(--color-surface-muted)]" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-44 rounded-xl bg-[var(--color-surface-muted)]" />)}
          </div>
          <div className="h-96 w-full rounded-xl bg-[var(--color-surface-muted)]" />
        </div>
      </div>
    </div>
  )

  if (!user) return <div className="page-shell p-10 text-center text-muted"><p className="mb-4">Sign in to view your progress.</p><Button onClick={() => router.push('/auth/login')}>Sign in</Button></div>

  return (
    <div className="page-shell">
      <div className="w-full space-y-10 py-4">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-subtle font-bold">Progress</p>
            <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-strong mt-2">Progress and insights</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="md" type="button" onClick={handleCreateManualSession} disabled={creatingManualSession}>
              {creatingManualSession ? 'Creating...' : 'Log past workout'}
            </Button>
            <Button variant="secondary" size="md" type="button" onClick={() => { setStartDate(''); setEndDate(''); setSelectedMuscle('all'); setSelectedExercise('all'); }}>
              Reset filters
            </Button>
          </div>
        </div>
        
        {error && <div className="alert-error p-6 text-base font-medium">{error}</div>}
        
        <div className="grid grid-cols-1 gap-12">
          <TrainingStatusCard {...trainingLoadSummary} />

          <div className="sticky top-6 z-40 transition-all duration-300">
            <ProgressFilters 
              startDate={startDate} 
              setStartDate={setStartDate} 
              endDate={endDate} 
              setEndDate={setEndDate} 
              selectedMuscle={selectedMuscle} 
              setSelectedMuscle={setSelectedMuscle} 
              selectedExercise={selectedExercise} 
              setSelectedExercise={setSelectedExercise} 
              exerciseOptions={exerciseOptions} 
            />
          </div>
          
          <MetricCards 
            prMetrics={prMetrics} 
            aggregateMetrics={aggregateMetrics} 
            readinessAverages={readinessAverages} 
            sessionCount={filteredSessions.length} 
            sessionsPerWeek={sessionsPerWeek}
            muscleBreakdown={muscleBreakdown}
          />

          <ProgressCharts 
            volumeTrend={volumeTrend} 
            effortTrend={effortTrend} 
            exerciseTrend={exerciseTrend} 
            bodyWeightData={bodyWeightData} 
            readinessSeries={readinessSeries} 
            readinessComponents={readinessComponents} 
            readinessCorrelation={readinessCorrelation} 
            readinessTrendLine={readinessTrendLine} 
          />

          <SessionHistoryList 
            sessions={filteredSessions} 
            templateById={templateById} 
            exerciseLibraryByName={exerciseLibraryByName} 
            getSessionTitle={getSessionTitle} 
            hasMore={hasMoreSessions} 
            onLoadMore={() => setSessionPage(p => p + 1)} 
            onDeleteSuccess={(id) => setSessions(prev => prev.filter(s => s.id !== id))} 
            onError={setError} 
            loading={loading} 
          />
        </div>
      </div>
    </div>
  )
}