'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { useUIStore } from '@/store/uiStore'
import { LBS_PER_KG, KG_PER_LB } from '@/lib/units'
import { MuscleSplitChart, type MuscleBreakdownPoint } from '@/components/progress/MuscleSplitChart'

interface MetricCardsProps {
  prMetrics: {
    maxWeight: number
    bestReps: number
  }
  aggregateMetrics: {
    bestE1rm: number
    tonnage: number
    workload: number
    avgWorkload: number
    hardSets: number
    avgEffort: number | null
  }
  readinessAverages: {
    score: number | null
  } | null
  sessionCount: number
  sessionsPerWeek: number
  muscleBreakdown: MuscleBreakdownPoint[]
}

export function MetricCards({
  prMetrics,
  aggregateMetrics,
  readinessAverages,
  sessionCount,
  sessionsPerWeek,
  muscleBreakdown
}: MetricCardsProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'

  const displayE1rm = isKg 
    ? Math.round(aggregateMetrics.bestE1rm || prMetrics.maxWeight * KG_PER_LB || 0)
    : Math.round((aggregateMetrics.bestE1rm || 0) * LBS_PER_KG || prMetrics.maxWeight || 0)
    
  const displayMaxWeight = isKg
    ? Math.round(prMetrics.maxWeight * KG_PER_LB)
    : prMetrics.maxWeight

  const displayTonnage = isKg
    ? Math.round(aggregateMetrics.tonnage * KG_PER_LB)
    : Math.round(aggregateMetrics.tonnage)

  const displayWorkload = isKg
    ? Math.round(aggregateMetrics.workload * KG_PER_LB)
    : Math.round(aggregateMetrics.workload)

  const displayAvgWorkload = isKg
    ? Math.round(aggregateMetrics.avgWorkload * KG_PER_LB)
    : Math.round(aggregateMetrics.avgWorkload)

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <Card className="p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-subtle">Performance PRs</h3>
            <ChartInfoTooltip 
              description="Shows the heaviest weights you've lifted. Your 'Peak' is an estimate of your 1-rep max strength."
              goal="Try to see these numbers slowly go up every few months. It's proof you're getting stronger!"
            />
          </div>
          <div className="mt-2">
            <p className="text-5xl font-extrabold tracking-tighter text-strong">{displayE1rm}</p>
            <p className="text-[11px] uppercase font-bold tracking-wider text-subtle/80 mt-1">Peak e1RM / Max ({displayUnit})</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-border)] space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle font-semibold">Best reps</span>
            <span className="text-strong font-bold">{prMetrics.bestReps} reps</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle font-semibold">Max weight</span>
            <span className="text-strong font-bold">{displayMaxWeight} {displayUnit}</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-subtle">Workload & Volume</h3>
            <ChartInfoTooltip 
              description="Tonnage is the total amount of weight you moved (sets x reps x weight). Workload is tonnage adjusted for how hard you worked."
              goal="Higher total work over time usually leads to more muscle growth, as long as you can recover from it."
            />
          </div>
          <div className="mt-2">
            <p className="text-5xl font-extrabold tracking-tighter text-strong">{displayTonnage.toLocaleString()}</p>
            <p className="text-[11px] uppercase font-bold tracking-wider text-subtle/80 mt-1">Total Tonnage ({displayUnit})</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-black text-subtle/60 tracking-wider mb-1">Workload</span>
              <span className="text-base font-bold text-strong leading-none">{displayWorkload.toLocaleString()}</span>
            </div>
            <div className="flex flex-col border-x border-[var(--color-border)] px-3">
              <span className="text-[9px] uppercase font-black text-subtle/60 tracking-wider mb-1">Avg Load</span>
              <span className="text-base font-bold text-strong leading-none">{displayAvgWorkload.toLocaleString()}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[9px] uppercase font-black text-subtle/60 tracking-wider mb-1">Hard Sets</span>
              <span className="text-base font-bold text-strong leading-none">{aggregateMetrics.hardSets}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-subtle">Activity & Recovery</h3>
            <ChartInfoTooltip 
              description="Consistency is how often you show up. Readiness is how good your body feels. Effort is how hard you push when you're there."
              goal="The goal is to show up consistently and push hard when your readiness score is high."
            />
          </div>
          <div className="mt-2">
            <p className="text-5xl font-extrabold tracking-tighter text-strong">
              {typeof readinessAverages?.score === 'number' ? Math.round(readinessAverages.score) : 'N/A'}
            </p>
            <p className="text-[11px] uppercase font-bold tracking-wider text-subtle/80 mt-1">Readiness Avg</p>
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
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-border)] space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle font-semibold">Sessions</span>
            <span className="text-strong font-bold">{sessionCount} total</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle font-semibold">Consistency</span>
            <span className="text-strong font-bold">{sessionsPerWeek}/wk</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle font-semibold">Avg Effort</span>
            <span className="text-strong font-bold">{aggregateMetrics.avgEffort ?? 'N/A'}/10</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <MuscleSplitChart data={muscleBreakdown} isCompact />
      </Card>
    </div>
  )
}