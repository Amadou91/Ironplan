'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProgressFilters } from '@/components/progress/ProgressFilters'
import { MetricCards } from '@/components/progress/MetricCards'
import { useProgressMetrics } from '@/hooks/useProgressMetrics'

const ProgressCharts = dynamic(
  () => import('@/components/progress/ProgressCharts').then((mod) => mod.ProgressCharts),
  {
    loading: () => <Skeleton className="h-96 w-full" />
  }
)

export default function ProgressPage() {
  const router = useRouter()
  const {
    user, userLoading, loading, error, filteredSessions,
    exerciseOptions, startDate, setStartDate, endDate, setEndDate,
    selectedMuscle, setSelectedMuscle, selectedExercise, setSelectedExercise,
    aggregateMetrics,
    prMetrics, readinessAverages, readinessSeries, readinessComponents,
    readinessCorrelation, readinessTrendLine, volumeTrend, effortTrend,
    exerciseTrend, muscleBreakdown, bodyWeightData, sessionsPerWeek
  } = useProgressMetrics()
  const handleLogPastWorkout = useCallback(() => {
    router.push('/sessions/log')
  }, [router])

  // Only show the full-page skeleton on the very first load.
  // After data has been fetched once, never unmount ProgressFilters (which
  // would reset the mobileExpanded accordion state mid-interaction).
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false)
  if (!hasFetchedOnce && !userLoading && !loading) {
    setHasFetchedOnce(true)
  }
  const isInitialLoad = !hasFetchedOnce && (userLoading || loading)
  if (isInitialLoad) return (
    <div className="page-shell">
      <div className="page-stack">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
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
        
        <div className="grid grid-cols-1 gap-6">
          <div className="sticky top-[calc(0.5rem+env(safe-area-inset-top,0px))] z-40 sm:top-4 lg:top-6">
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

          <section className="space-y-5 border-t border-[var(--color-border)] pt-6" aria-label="Full drilldown analytics">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="type-section-title text-strong">Full drilldown</h2>
                <p className="type-meta text-subtle">
                  Charts for your selected filters
                </p>
              </div>
            </div>

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
          </section>

        </div>
      </div>
    </div>
  )
}
