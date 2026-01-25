'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Bar,
  Cell,
  Scatter,
  ReferenceArea,
  ReferenceLine
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { TrainingStatusCard } from '@/components/progress/TrainingStatusCard'
import { WeeklyVolumeChart } from '@/components/progress/WeeklyVolumeChart'
import { ProgressFilters } from '@/components/progress/ProgressFilters'
import { SessionHistoryList } from '@/components/progress/SessionHistoryList'
import { useProgressMetrics } from '@/hooks/useProgressMetrics'
import { createClient } from '@/lib/supabase/client'

export default function ProgressPage() {
  const router = useRouter()
  const supabase = createClient()
  const {
    user,
    userLoading,
    loading,
    error,
    setError,
    setSessions,
    filteredSessions,
    templateById,
    exerciseOptions,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedMuscle,
    setSelectedMuscle,
    selectedExercise,
    setSelectedExercise,
    hasMoreSessions,
    setSessionPage,
    trainingLoadSummary,
    aggregateMetrics,
    prMetrics,
    readinessAverages,
    readinessSeries,
    readinessComponents,
    readinessCorrelation,
    readinessTrendLine,
    volumeTrend,
    effortTrend,
    exerciseTrend,
    muscleBreakdown,
    bodyWeightData,
    sessionsPerWeek,
    getSessionTitle,
    exerciseLibraryByName,
    ensureSession
  } = useProgressMetrics()

  const [creatingManualSession, setCreatingManualSession] = useState(false)

  const handleCreateManualSession = useCallback(async () => {
    setCreatingManualSession(true)
    setError(null)
    const session = await ensureSession()
    if (!session) {
      setCreatingManualSession(false)
      return
    }

    try {
      const now = new Date()
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert({
          user_id: session.user.id,
          name: 'Manual workout',
          status: 'completed',
          started_at: now.toISOString(),
          ended_at: now.toISOString(),
          timezone
        })
        .select('id')
        .single()

      if (insertError || !data) {
        throw insertError ?? new Error('Failed to create manual session.')
      }

      router.push(`/sessions/${data.id}/edit`)
    } catch (error) {
      console.error('Failed to create manual session', error)
      setError('Unable to create a manual session. Please try again.')
    } finally {
      setCreatingManualSession(false)
    }
  }, [ensureSession, router, supabase, setError])

  const handleResetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedMuscle('all')
    setSelectedExercise('all')
  }

  if (userLoading || loading) {
    return (
      <div className="page-shell">
        <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16 animate-pulse">
          <div className="h-20 w-full rounded bg-[var(--color-surface-muted)]" />
          <div className="h-[300px] w-full rounded bg-[var(--color-surface-muted)]" />
          <div className="h-[250px] w-full rounded bg-[var(--color-surface-muted)]" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded bg-[var(--color-surface-muted)]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to view your progress.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-subtle">Progress</p>
            <h1 className="font-display text-3xl font-semibold text-strong">Progress and insights</h1>
            <p className="mt-2 text-sm text-muted">Monitor training volume, intensity, and patterns across sessions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCreateManualSession} disabled={creatingManualSession}>
              {creatingManualSession ? 'Creating...' : 'Log past workout'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>Reset filters</Button>
          </div>
        </div>

        {error && <div className="alert-error p-4 text-sm">{error}</div>}

        <TrainingStatusCard 
          status={trainingLoadSummary.status}
          loadRatio={trainingLoadSummary.loadRatio}
          weeklyLoad={trainingLoadSummary.acuteLoad}
          chronicWeeklyAvg={trainingLoadSummary.chronicWeeklyAvg}
          insufficientData={trainingLoadSummary.insufficientData}
          isInitialPhase={trainingLoadSummary.isInitialPhase}
        />

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
          muscleBreakdown={muscleBreakdown}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Performance PRs</h3>
              <ChartInfoTooltip 
                description="Shows the heaviest weights you've lifted. Your 'Peak' is an estimate of your 1-rep max strength."
                goal="Try to see these numbers slowly go up every few months. It's proof you're getting stronger!"
              />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-semibold text-strong">{aggregateMetrics.bestE1rm || prMetrics.maxWeight || 0}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-subtle">Peak e1RM / Max (lb)</p>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Best reps</span>
                <span className="text-strong font-semibold">{prMetrics.bestReps} reps</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Max weight</span>
                <span className="text-strong font-semibold">{prMetrics.maxWeight} lb</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Workload & Volume</h3>
              <ChartInfoTooltip 
                description="Tonnage is the total amount of weight you moved (sets x reps x weight). Workload is tonnage adjusted for how hard you worked."
                goal="Higher total work over time usually leads to more muscle growth, as long as you can recover from it."
              />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-semibold text-strong">{aggregateMetrics.tonnage.toLocaleString()}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-subtle">Total Tonnage (lb)</p>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="flex justify-between items-center text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-subtle tracking-tighter">Total Workload</span>
                  <span className="text-strong font-semibold">{aggregateMetrics.workload.toLocaleString()}</span>
                </div>
                <div className="h-8 w-px bg-[var(--color-border)] mx-2" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-subtle tracking-tighter">Avg Load</span>
                  <span className="text-strong font-semibold">{aggregateMetrics.avgWorkload.toLocaleString()}</span>
                </div>
                <div className="h-8 w-px bg-[var(--color-border)] mx-2" />
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase font-bold text-subtle tracking-tighter">Hard Sets</span>
                  <span className="text-strong font-semibold">{aggregateMetrics.hardSets}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Activity & Recovery</h3>
              <ChartInfoTooltip 
                description="Consistency is how often you show up. Readiness is how good your body feels. Effort is how hard you push when you're there."
                goal="The goal is to show up consistently and push hard when your readiness score is high."
              />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-semibold text-strong">
                {typeof readinessAverages?.score === 'number' ? Math.round(readinessAverages.score) : 'N/A'}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-subtle">Readiness Avg</p>
              {typeof readinessAverages?.score === 'number' && (
                <div className="mt-4">
                  <div className="h-1.5 w-full bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        readinessAverages.score >= 70 ? 'bg-[var(--color-success)]' :
                        readinessAverages.score >= 40 ? 'bg-[var(--color-warning)]' :
                        'bg-[var(--color-danger)]'
                      }`}
                      style={{ width: `${readinessAverages.score}%` }} 
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Sessions</span>
                <span className="text-strong font-semibold">{filteredSessions.length} total</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Consistency</span>
                <span className="text-strong font-semibold">{sessionsPerWeek} / week</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Avg Effort</span>
                <span className="text-strong font-semibold">{aggregateMetrics.avgEffort ?? 'N/A'}/10</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Volume & load</h3>
            </div>
            <WeeklyVolumeChart data={volumeTrend} />
          </Card>

          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Effort trend</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={effortTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="effort" stroke="var(--color-success)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {exerciseTrend.length > 0 && (
            <Card className="p-6 min-w-0">
              <div className="mb-4 flex items-center">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">e1RM trend</h3>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exerciseTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                    <YAxis stroke="var(--color-text-subtle)" />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="e1rm" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Bodyweight trend</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bodyWeightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis domain={['auto', 'auto']} stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="weight" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness score trend</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={readinessSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis domain={[0, 100]} stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness components</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={readinessComponents}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="metric" stroke="var(--color-text-subtle)" />
                  <YAxis domain={[1, 5]} stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                  <Bar dataKey="value">
                    {readinessComponents.map((entry) => {
                      let color = '#0ea5e9'
                      if (entry.metric === 'Sleep' || entry.metric === 'Motivation') {
                        if (entry.value >= 4) color = '#1f9d55'
                        else if (entry.value >= 3) color = '#f59e0b'
                        else color = '#f05a28'
                      } else {
                        if (entry.value <= 2) color = '#1f9d55'
                        else if (entry.value <= 3) color = '#f59e0b'
                        else color = '#f05a28'
                      }
                      return <Cell key={entry.metric} fill={color} />
                    })}
                  </Bar>
                  <Scatter dataKey="ideal" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className={`p-6 min-w-0 ${exerciseTrend.length > 0 ? 'lg:col-span-2' : ''}`}>
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness vs session effort</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="readiness" type="number" domain={[0, 100]} stroke="var(--color-text-subtle)" />
                  <YAxis dataKey="effort" type="number" domain={[0, 10]} stroke="var(--color-text-subtle)" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <ReferenceArea x1={0} x2={50} y1={5} y2={10} fill="var(--color-danger)" fillOpacity={0.03} />
                  <ReferenceArea x1={50} x2={100} y1={5} y2={10} fill="var(--color-success)" fillOpacity={0.03} />
                  <ReferenceLine x={50} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <ReferenceLine y={5} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <Scatter data={readinessCorrelation} fill="var(--color-primary)" />
                  <Line data={readinessTrendLine} dataKey="effort" stroke="var(--color-text-subtle)" strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <SessionHistoryList
          sessions={filteredSessions}
          templateById={templateById}
          exerciseLibraryByName={exerciseLibraryByName}
          getSessionTitle={getSessionTitle}
          hasMore={hasMoreSessions}
          onLoadMore={() => setSessionPage((prev) => prev + 1)}
          onDeleteSuccess={(id) => setSessions((prev) => prev.filter((s) => s.id !== id))}
          onError={setError}
          loading={loading}
        />
      </div>
    </div>
  )
}
