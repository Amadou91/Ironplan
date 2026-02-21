'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProgressFilters } from '@/components/progress/ProgressFilters'
import { MetricCards } from '@/components/progress/MetricCards'
import { CoachFeed } from '@/components/progress/CoachFeed'
import { useProgressMetrics } from '@/hooks/useProgressMetrics'
import {
  buildActionScopeSummary,
  buildFilterScopeSummary,
  generateCoachFeedInsights
} from '@/lib/progress/coach-feed'

const ProgressCharts = dynamic(
  () => import('@/components/progress/ProgressCharts').then((mod) => mod.ProgressCharts),
  {
    loading: () => <Skeleton className="h-96 w-full" />
  }
)

const SessionHistoryList = dynamic(
  () => import('@/components/progress/SessionHistoryList').then((mod) => mod.SessionHistoryList),
  {
    loading: () => <Skeleton className="h-[28rem] w-full" />
  }
)

export default function ProgressPage() {
  const router = useRouter()
  const {
    user, userLoading, loading, error, setError, setSessions, filteredSessions,
    exerciseOptions, startDate, setStartDate, endDate, setEndDate,
    selectedMuscle, setSelectedMuscle, selectedExercise, setSelectedExercise,
    hasMoreSessions, setSessionPage, trainingLoadSummary, aggregateMetrics,
    prMetrics, readinessAverages, readinessSeries, readinessComponents,
    readinessCorrelation, readinessTrendLine, volumeTrend, effortTrend,
    exerciseTrend, muscleBreakdown, bodyWeightData, sessionsPerWeek,
    getSessionTitle, exerciseLibraryByName, coachActionScope
  } = useProgressMetrics()
  const handleLogPastWorkout = useCallback(() => {
    router.push('/sessions/log')
  }, [router])

  const handleImportSuccess = useCallback(() => {
    // Clear sessions and reset to page 0 to trigger a fresh load
    setSessions([])
    setSessionPage(0)
  }, [setSessions, setSessionPage])

  // Only show the full-page skeleton on the very first load.
  // After data has been fetched once, never unmount ProgressFilters (which
  // would reset the mobileExpanded accordion state mid-interaction).
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false)
  const [showDrilldown, setShowDrilldown] = useState(false)
  if (!hasFetchedOnce && !userLoading && !loading && !coachActionScope.loading) {
    setHasFetchedOnce(true)
  }
  const isInitialLoad = !hasFetchedOnce && (userLoading || loading || coachActionScope.loading)
  const filterScope = useMemo(() => buildFilterScopeSummary({
    startDate,
    endDate,
    selectedMuscle,
    selectedExercise
  }), [startDate, endDate, selectedMuscle, selectedExercise])
  const actionScope = useMemo(() => buildActionScopeSummary({
    selectedMuscle,
    selectedExercise,
    timeHorizonLabel: coachActionScope.timeHorizonLabel
  }), [coachActionScope.timeHorizonLabel, selectedExercise, selectedMuscle])

  const coachInsights = useMemo(() => generateCoachFeedInsights({
    filteredSessionCount: coachActionScope.filteredSessionCount,
    sessionsPerWeek: coachActionScope.sessionsPerWeek,
    readinessScore: coachActionScope.readinessScore,
    avgEffort: coachActionScope.avgEffort,
    hardSets: coachActionScope.hardSets,
    trainingLoadSummary: {
      status: coachActionScope.trainingLoadSummary.status,
      loadRatio: coachActionScope.trainingLoadSummary.loadRatio,
      insufficientData: coachActionScope.trainingLoadSummary.insufficientData,
      isInitialPhase: coachActionScope.trainingLoadSummary.isInitialPhase,
      daysSinceLast: coachActionScope.trainingLoadSummary.daysSinceLast
    },
    timeHorizonLabel: coachActionScope.timeHorizonLabel
  }), [
    coachActionScope.avgEffort,
    coachActionScope.filteredSessionCount,
    coachActionScope.hardSets,
    coachActionScope.readinessScore,
    coachActionScope.sessionsPerWeek,
    coachActionScope.timeHorizonLabel,
    coachActionScope.trainingLoadSummary.daysSinceLast,
    coachActionScope.trainingLoadSummary.insufficientData,
    coachActionScope.trainingLoadSummary.isInitialPhase,
    coachActionScope.trainingLoadSummary.loadRatio,
    coachActionScope.trainingLoadSummary.status
  ])

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
          <div className="sticky top-[calc(0.5rem+env(safe-area-inset-top,0px))] z-40 transition-all duration-500 sm:top-4 lg:top-6">
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

          <CoachFeed
            insights={coachInsights}
            timeHorizonLabel={actionScope.parts[0]}
            focusLabel={`${actionScope.parts[1]} • ${actionScope.parts[2]}`}
          />

          <section className="space-y-6" aria-label="Key summaries">
            <MetricCards
              prMetrics={prMetrics}
              aggregateMetrics={aggregateMetrics}
              readinessAverages={readinessAverages}
              sessionCount={filteredSessions.length}
              sessionsPerWeek={sessionsPerWeek}
              muscleBreakdown={muscleBreakdown}
            />
          </section>

          <section className="space-y-6 border-t border-[var(--color-border)] pt-8" aria-label="Full drilldown analytics">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-strong">Full Drilldown</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-subtle">
                  Charts for {filterScope.isFiltered ? 'active filters' : 'all data'}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDrilldown((prev) => !prev)}
                className="h-10 px-4 text-xs font-black uppercase tracking-widest"
              >
                {showDrilldown ? 'Hide drilldown' : 'Show full drilldown'}
                {showDrilldown ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
              </Button>
            </div>

            {!showDrilldown ? (
              <Card className="glass-panel border border-dashed border-[var(--color-border)] p-6">
                <p className="text-sm text-subtle">
                  Drilldown is hidden. Expand to see charts.
                </p>
              </Card>
            ) : (
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
            )}
          </section>

          <section className="space-y-6 border-t border-[var(--color-border)] pt-8" aria-label="Previous sessions">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-strong">Previous Sessions</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-subtle">
                  Session history for {filterScope.isFiltered ? 'active filters' : 'all data'}
                </p>
              </div>
            </div>

            <SessionHistoryList
              sessions={filteredSessions}
              exerciseLibraryByName={exerciseLibraryByName}
              getSessionTitle={getSessionTitle}
              hasMore={hasMoreSessions}
              onLoadMore={() => setSessionPage((p) => p + 1)}
              onDeleteSuccess={(id) => setSessions((prev) => prev.filter((s) => s.id !== id))}
              onError={setError}
              loading={loading}
              onImportSuccess={handleImportSuccess}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
