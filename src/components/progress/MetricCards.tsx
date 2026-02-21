'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { useUIStore } from '@/store/uiStore'
import { LBS_PER_KG, KG_PER_LB } from '@/lib/units'
import { READINESS_HIGH_THRESHOLD, READINESS_LOW_THRESHOLD } from '@/constants/training'
import { MuscleSplitChart, type MuscleBreakdownPoint } from '@/components/progress/MuscleSplitChart'

interface MetricCardsProps {
  prMetrics: {
    maxWeight: number
    bestReps: number
  }
  aggregateMetrics: {
    bestE1rm: number
    bestRelativeStrength: number
    tonnage: number
    workload: number
    strengthLoad: number
    recoveryLoad: number
    strengthLoadPct: number
    recoveryLoadPct: number
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

  const displayStrengthLoad = isKg
    ? Math.round(aggregateMetrics.strengthLoad * KG_PER_LB)
    : Math.round(aggregateMetrics.strengthLoad)

  const displayRecoveryLoad = isKg
    ? Math.round(aggregateMetrics.recoveryLoad * KG_PER_LB)
    : Math.round(aggregateMetrics.recoveryLoad)

  const displayAvgWorkload = isKg
    ? Math.round(aggregateMetrics.avgWorkload * KG_PER_LB)
    : Math.round(aggregateMetrics.avgWorkload)

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <Card className="p-6 flex flex-col justify-between glass-panel">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/80">Performance PRs</h3>
            <ChartInfoTooltip 
              description="Shows the heaviest weights you've lifted. Your 'Peak' is an estimate of your 1-rep max strength."
              goal="Try to see these numbers slowly go up every few months. It's proof you're getting stronger!"
            />
          </div>
          <div className="mt-2">
            <p className="text-5xl font-extrabold tracking-tighter text-strong">{displayE1rm}</p>
            <p className="text-[10px] uppercase font-black tracking-[0.1em] text-subtle/60 mt-1.5">Peak e1RM / Max ({displayUnit})</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-border)] space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle/80 font-bold uppercase tracking-widest text-[10px]">Best reps</span>
            <span className="text-strong font-black text-base">{prMetrics.bestReps} reps</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle/80 font-bold uppercase tracking-widest text-[10px]">Max weight</span>
            <span className="text-strong font-black text-base">{displayMaxWeight} {displayUnit}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle/80 font-bold uppercase tracking-widest text-[10px]">Relative</span>
            <span className="text-strong font-black text-base">
              {aggregateMetrics.bestRelativeStrength > 0 ? `${aggregateMetrics.bestRelativeStrength.toFixed(2)}x BW` : 'N/A'}
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-6 flex flex-col justify-between glass-panel">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/80">Workload & Volume</h3>
            <ChartInfoTooltip 
              description="Tonnage is the total amount of weight you moved (sets x reps x weight). Workload is tonnage adjusted for how hard you worked."
              goal="Higher total work over time usually leads to more muscle growth, as long as you can recover from it."
            />
          </div>
          <div className="mt-2">
            <p className="text-5xl font-extrabold tracking-tighter text-strong">{displayTonnage.toLocaleString()}</p>
            <p className="text-[10px] uppercase font-black tracking-[0.1em] text-subtle/60 mt-1.5">Total Tonnage ({displayUnit})</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black text-subtle/60 tracking-wider mb-1.5">Workload</span>
              <span className="text-base font-bold text-strong leading-none">{displayWorkload.toLocaleString()}</span>
            </div>
            <div className="flex flex-col border-x border-[var(--color-border)] px-3">
              <span className="text-[10px] uppercase font-black text-subtle/60 tracking-wider mb-1.5">Avg Load</span>
              <span className="text-base font-bold text-strong leading-none">{displayAvgWorkload.toLocaleString()}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase font-black text-subtle/60 tracking-wider mb-1.5">Hard Sets</span>
              <span className="text-base font-bold text-strong leading-none">{aggregateMetrics.hardSets}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-subtle/70">
              <span>Hard vs Light Load</span>
              <span>{aggregateMetrics.strengthLoadPct}% / {aggregateMetrics.recoveryLoadPct}%</span>
            </div>
            <div className="h-2.5 w-full bg-[var(--color-surface-muted)] rounded-full overflow-hidden border border-[var(--color-border)]/40">
              <div className="h-full bg-[var(--color-primary)]" style={{ width: `${aggregateMetrics.strengthLoadPct}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-subtle/80">
              <span>Hard: {displayStrengthLoad.toLocaleString()} {displayUnit}</span>
              <span className="text-right">Light: {displayRecoveryLoad.toLocaleString()} {displayUnit}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 flex flex-col justify-between glass-panel">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/80">Activity & Recovery</h3>
            <ChartInfoTooltip 
              description="Consistency is how often you show up. Readiness is how good your body feels. Effort is how hard you push when you're there."
              goal="The goal is to show up consistently and push hard when your readiness score is high."
            />
          </div>
          <div className="mt-2">
            <p className="text-5xl font-extrabold tracking-tighter text-strong">
              {typeof readinessAverages?.score === 'number' ? Math.round(readinessAverages.score) : 'N/A'}
            </p>
            <p className="text-[10px] uppercase font-black tracking-[0.1em] text-subtle/60 mt-1.5">Readiness Avg</p>
            {typeof readinessAverages?.score === 'number' && (
              <div className="mt-5">
                <div className="h-2 w-full bg-[var(--color-surface-muted)] rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-1000 ${
                      readinessAverages.score >= READINESS_HIGH_THRESHOLD ? 'bg-[var(--color-success)]' :
                      readinessAverages.score >= READINESS_LOW_THRESHOLD ? 'bg-[var(--color-warning)]' :
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
            <span className="text-subtle/80 font-bold uppercase tracking-widest text-[10px]">Sessions</span>
            <span className="text-strong font-black text-base">{sessionCount} total</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle/80 font-bold uppercase tracking-widest text-[10px]">Consistency</span>
            <span className="text-strong font-black text-base">{sessionsPerWeek}/wk</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-subtle/80 font-bold uppercase tracking-widest text-[10px]">Avg Effort</span>
            <span className="text-strong font-black text-base">{aggregateMetrics.avgEffort ?? 'N/A'}/10</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 glass-panel">
        <MuscleSplitChart data={muscleBreakdown} isCompact />
      </Card>
    </div>
  )
}
