'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
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
    getSessionTitle, exerciseLibraryByName
  } = useProgressMetrics()

  const handleLogPastWorkout = useCallback(() => {
    router.push('/sessions/log')
  }, [router])

  const handleImportSuccess = useCallback(() => {
    // Clear sessions and reset to page 0 to trigger a fresh load
    setSessions([])
    setSessionPage(0)
  }, [setSessions, setSessionPage])

  // Only show full page skeleton on initial load or when we have no data
  const isInitialLoad = userLoading || (loading && sessions.length === 0)

  if (isInitialLoad) return (
    <div className="page-shell">
      <div className="page-stack">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-8">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  )

  if (!user) {
    return (
      <div className="page-shell page-stack">
        <EmptyState
          title="Sign in to view your progress"
          description="Track trends, readiness, and long-term training signals once you sign in."
          action={<Button onClick={() => router.push('/auth/login')}>Sign in</Button>}
        />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-stack">
        <PageHeader
          eyebrow="Performance hub"
          title="Progress & Insights"
          actions={
            <>
              <Button variant="outline" type="button" onClick={handleLogPastWorkout}>
                Log past workout
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  setSelectedMuscle('all')
                  setSelectedExercise('all')
                }}
              >
                Reset filters
              </Button>
            </>
          }
        />
        
        {error ? <Alert variant="error">{error}</Alert> : null}
        
        <div className="grid grid-cols-1 gap-8">
          <TrainingStatusCard {...trainingLoadSummary} />

          <div className="sticky top-2 z-40 transition-all duration-500 sm:top-4 md:top-6">
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

          <div className="pt-8 border-t border-[var(--color-border)]">
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
              onImportSuccess={handleImportSuccess}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
