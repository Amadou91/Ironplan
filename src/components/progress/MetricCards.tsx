'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'

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
  return (
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
            <span className="text-strong font-semibold">{sessionCount} total</span>
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
  )
}
