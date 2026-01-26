'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { useUIStore } from '@/store/uiStore'
import { LBS_PER_KG, KG_PER_LB } from '@/lib/units'

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
}

export function MetricCards({
  prMetrics,
  aggregateMetrics,
  readinessAverages,
  sessionCount,
  sessionsPerWeek
}: MetricCardsProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'

  // Performance metrics (usually internal standard is KG for e1RM)
  // But wait, prMetrics.maxWeight and aggregateMetrics.bestE1rm - where do they come from?
  // Checking aggregateMetrics.bestE1rm usually it's KG.
  // prMetrics.maxWeight?
  
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
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <Card className="p-10">
        <div className="flex items-center mb-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Performance PRs</h3>
          <ChartInfoTooltip 
            description="Shows the heaviest weights you've lifted. Your 'Peak' is an estimate of your 1-rep max strength."
            goal="Try to see these numbers slowly go up every few months. It's proof you're getting stronger!"
          />
        </div>
        <div className="mt-4">
          <p className="text-4xl font-extrabold text-strong">{displayE1rm}</p>
          <p className="text-xs uppercase font-bold tracking-widest text-subtle mt-1.5">Peak e1RM / Max ({displayUnit})</p>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-border)] space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-subtle font-medium">Best reps</span>
            <span className="text-strong font-bold">{prMetrics.bestReps} reps</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-subtle font-medium">Max weight</span>
            <span className="text-strong font-bold">{displayMaxWeight} {displayUnit}</span>
          </div>
        </div>
      </Card>

      <Card className="p-10">
        <div className="flex items-center mb-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Workload & Volume</h3>
          <ChartInfoTooltip 
            description="Tonnage is the total amount of weight you moved (sets x reps x weight). Workload is tonnage adjusted for how hard you worked."
            goal="Higher total work over time usually leads to more muscle growth, as long as you can recover from it."
          />
        </div>
        <div className="mt-4">
          <p className="text-4xl font-extrabold text-strong">{displayTonnage.toLocaleString()}</p>
          <p className="text-xs uppercase font-bold tracking-widest text-subtle mt-1.5">Total Tonnage ({displayUnit})</p>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <div className="flex justify-between items-center text-sm">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-subtle tracking-tight mb-1">Workload</span>
              <span className="text-strong font-bold">{displayWorkload.toLocaleString()}</span>
            </div>
            <div className="h-10 w-px bg-[var(--color-border)] mx-3" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-subtle tracking-tight mb-1">Avg Load</span>
              <span className="text-strong font-bold">{displayAvgWorkload.toLocaleString()}</span>
            </div>
            <div className="h-10 w-px bg-[var(--color-border)] mx-3" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase font-bold text-subtle tracking-tight mb-1">Hard Sets</span>
              <span className="text-strong font-bold">{aggregateMetrics.hardSets}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-10">
        <div className="flex items-center mb-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Activity & Recovery</h3>
          <ChartInfoTooltip 
            description="Consistency is how often you show up. Readiness is how good your body feels. Effort is how hard you push when you're there."
            goal="The goal is to show up consistently and push hard when your readiness score is high."
          />
        </div>
        <div className="mt-4">
          <p className="text-4xl font-extrabold text-strong">
            {typeof readinessAverages?.score === 'number' ? Math.round(readinessAverages.score) : 'N/A'}
          </p>
          <p className="text-xs uppercase font-bold tracking-widest text-subtle mt-1.5">Readiness Avg</p>
          {typeof readinessAverages?.score === 'number' && (
            <div className="mt-6">
              <div className="h-2 w-full bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
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
        <div className="mt-8 pt-6 border-t border-[var(--color-border)] space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-subtle font-medium">Sessions</span>
            <span className="text-strong font-bold">{sessionCount} total</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-subtle font-medium">Consistency</span>
            <span className="text-strong font-bold">{sessionsPerWeek} / week</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-subtle font-medium">Avg Effort</span>
            <span className="text-strong font-bold">{aggregateMetrics.avgEffort ?? 'N/A'}/10</span>
          </div>
        </div>
      </Card>
    </div>
  )
}