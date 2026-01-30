'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { TrainingStatusCard } from '@/components/progress/TrainingStatusCard'
import { ProgressFilters } from '@/components/progress/ProgressFilters'
import { SessionHistoryList } from '@/components/progress/SessionHistoryList'
import { MetricCards } from '@/components/progress/MetricCards'
import { ProgressCharts } from '@/components/progress/ProgressCharts'
import { useProgressMetrics } from '@/hooks/useProgressMetrics'

export default function ProgressPage() {
  const router = useRouter()
  const {
    user, userLoading, loading, error, setError, sessions, setSessions, filteredSessions,
    exerciseOptions, startDate, setStartDate, endDate, setEndDate,
    selectedMuscle, setSelectedMuscle, selectedExercise, setSelectedExercise,
    hasMoreSessions, setSessionPage, trainingLoadSummary, aggregateMetrics,
    prMetrics, readinessAverages, readinessSeries, readinessComponents,
    readinessCorrelation, readinessTrendLine, volumeTrend, effortTrend,
    exerciseTrend, muscleBreakdown, bodyWeightData, sessionsPerWeek,
    getSessionTitle, exerciseLibraryByName, ensureSession
  } = useProgressMetrics()

  const handleLogPastWorkout = useCallback(() => {
    router.push('/sessions/log')
  }, [router])

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
      <div className="w-full space-y-12 py-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between px-1">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-subtle font-black opacity-70">Performance Hub</p>
            <h1 className="font-display text-4xl lg:text-6xl font-black text-strong mt-3 tracking-tight">Progress & Insights</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="outline" size="md" type="button" onClick={handleLogPastWorkout} className="h-12 px-6 text-[11px] font-black uppercase tracking-widest border-2">
              Log past workout
            </Button>
            <Button variant="secondary" size="md" type="button" onClick={() => { setStartDate(''); setEndDate(''); setSelectedMuscle('all'); setSelectedExercise('all'); }} className="h-12 px-6 text-[11px] font-black uppercase tracking-widest">
              Reset filters
            </Button>
          </div>
        </div>
        
        {error && <div className="alert-error p-6 text-base font-medium glass-panel border-red-200 dark:border-red-900/30">{error}</div>}
        
        <div className="grid grid-cols-1 gap-12">
          <TrainingStatusCard {...trainingLoadSummary} />

          <div className="sticky top-6 z-40 transition-all duration-500">
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

          <div className="pt-12 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1 bg-[var(--color-border)]" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-subtle opacity-60">Session History</h2>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>
            <SessionHistoryList 
              sessions={filteredSessions} 
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
    </div>
  )
}
