'use client'

import { Card } from '@/components/ui/Card'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'
import { ACR_THRESHOLDS } from '@/constants/training'

const ACR_CHART_MAX = 2.0

interface TrainingStatusCardProps {
  status: string
  loadRatio: number | string
  acuteLoad: number
  chronicWeeklyAvg: number | string
  insufficientData?: boolean
  isInitialPhase?: boolean
}

const getStatusDescription = (status: string, ratio: number, insufficientData?: boolean, isInitialPhase?: boolean) => {
  if (insufficientData) {
    return "Log your first session to begin tracking your systemic training load."
  }
  if (isInitialPhase) {
    return "You're in the 'Baseline Building' phase. We're establishing your normal work capacity. Keep logging sessions to unlock advanced recovery insights."
  }
  const percentage = Math.round(Math.abs(1 - ratio) * 100)
  if (status === 'undertraining') {
    return `Your recent load is ${percentage}% lower than your baseline. This reduces fatigue but may stall progress if maintained.`
  }
  if (status === 'overreaching') {
    return `You've increased volume by ${percentage}% abruptly. Short periods here can drive growth, but long periods increase injury risk.`
  }
  return "Your current training stress is well-matched to your fitness level, keeping you in the 'sweet spot' for progressive overload."
}

export function TrainingStatusCard({
  status,
  loadRatio,
  acuteLoad,
  chronicWeeklyAvg,
  insufficientData,
  isInitialPhase
}: TrainingStatusCardProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'
  const numericRatio = typeof loadRatio === 'number' ? loadRatio : parseFloat(loadRatio) || 0

  const displayAcuteLoad = isKg ? Math.round(acuteLoad * KG_PER_LB) : acuteLoad
  const displayChronicLoad = isKg ? Math.round(Number(chronicWeeklyAvg) * KG_PER_LB) : chronicWeeklyAvg

  return (
    <Card className={`relative z-10 border-t-4 glass-panel ${
      insufficientData || isInitialPhase ? 'border-t-[var(--color-border)]' :
      status === 'balanced' ? 'border-t-[var(--color-success)]' :
      status === 'overreaching' ? 'border-t-[var(--color-danger)]' :
      'border-t-[var(--color-warning)]'
    }`}>
      <div className="p-4 sm:p-6 md:p-10">
        <div className="flex flex-col gap-6 sm:gap-8 md:gap-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-black uppercase tracking-[0.06em] text-strong sm:tracking-[0.1em]">Systemic Training Status</h3>
                <ChartInfoTooltip 
                  description="The ratio between your Acute Load (Last 7 days) and Chronic Load (Last 28 days). It indicates if you are ramping up too fast or doing too little."
                  goal="Stay in the Green (Balanced) zone most of the time to get stronger without getting hurt."
                />
              </div>
              <p className="text-sm text-subtle italic font-medium sm:text-xs">Based on total body workload</p>
            </div>
            <div className="flex flex-col sm:items-end">
              <span className={`inline-flex max-w-full items-center px-3 py-2 rounded-xl text-xs font-black uppercase tracking-[0.06em] border-2 sm:px-5 sm:tracking-widest ${
                insufficientData || isInitialPhase ? 'bg-[var(--color-surface-muted)] text-subtle border-[var(--color-border)]' :
                status === 'balanced' ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success-border)]' :
                status === 'overreaching' ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger-border)]' :
                status === 'undertraining' ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] border border-[var(--color-primary-border)]' :
                'bg-[var(--color-surface-muted)] text-subtle border border-[var(--color-border)]'
              }`}>
                {insufficientData ? 'Insufficient Data' :
                 isInitialPhase ? 'Building Baseline' :
                 status === 'overreaching' ? 'overreaching' : status.replace('_', ' ')}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-4 lg:items-center lg:gap-12">
            <div className="space-y-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tighter text-strong sm:text-6xl">
                  {insufficientData || isInitialPhase ? '--' : loadRatio}
                </span>
                <span className="text-xs font-black text-subtle/60 uppercase tracking-[0.14em] sm:tracking-[0.2em]">ACR</span>
              </div>
              <p className="text-xs uppercase font-black tracking-[0.12em] text-subtle/50 sm:tracking-[0.2em] sm:text-subtle/40">Acute:Chronic Ratio</p>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <div className="relative pt-3">
                <div className="h-4 w-full bg-[var(--color-surface-muted)] rounded-full overflow-hidden flex shadow-inner border border-[var(--color-border)]/50">
                  <div className="h-full bg-[var(--color-warning)] opacity-20" style={{ width: `${(ACR_THRESHOLDS.undertraining / ACR_CHART_MAX) * 100}%` }} />
                  <div className="h-full bg-[var(--color-success)] opacity-30" style={{ width: `${((ACR_THRESHOLDS.overreaching - ACR_THRESHOLDS.undertraining) / ACR_CHART_MAX) * 100}%` }} />
                  <div className="h-full bg-[var(--color-danger)] opacity-20" style={{ width: `${((ACR_CHART_MAX - ACR_THRESHOLDS.overreaching) / ACR_CHART_MAX) * 100}%` }} />
                </div>
                {!insufficientData && !isInitialPhase && (
                  <div 
                    className={`absolute top-2 h-6 w-2 rounded-full transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) shadow-xl border-2 border-[var(--color-surface)] ${
                      status === 'balanced' ? 'bg-[var(--color-success)]' :
                      status === 'overreaching' ? 'bg-[var(--color-danger)]' :
                      'bg-[var(--color-primary)]'
                    }`}
                    style={{
                      left: `${Math.min(100, (numericRatio / ACR_CHART_MAX) * 100)}%`,
                      transform: 'translateX(-50%)'
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between px-1">
                <div className="text-center">
                  <span className="block text-xs font-black text-subtle/40 uppercase tracking-[0.08em] sm:tracking-widest sm:text-subtle/30">Low</span>
                  <span className="text-xs font-black text-subtle/70 sm:text-subtle/60">0.0-{ACR_THRESHOLDS.undertraining}</span>
                </div>
                <div className="text-center">
                  <span className="block text-xs font-black text-[var(--color-success)]/70 uppercase tracking-[0.08em] sm:tracking-widest sm:text-[var(--color-success)]/50">Sweet Spot</span>
                  <span className="text-xs font-black text-subtle/70 sm:text-subtle/60">{ACR_THRESHOLDS.undertraining}-{ACR_THRESHOLDS.overreaching}</span>
                </div>
                <div className="text-center">
                  <span className="block text-xs font-black text-[var(--color-danger)]/70 uppercase tracking-[0.08em] sm:tracking-widest sm:text-[var(--color-danger)]/50">High</span>
                  <span className="text-xs font-black text-subtle/70 sm:text-subtle/60">{ACR_THRESHOLDS.overreaching}+</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:border-l lg:border-[var(--color-border)] lg:pl-12">
              <div className="space-y-1.5">
                <p className="text-xs text-subtle/70 uppercase font-black tracking-[0.08em] sm:tracking-widest sm:text-subtle/60">Load (7d)</p>
                <p className="text-2xl font-black text-strong tracking-tight sm:text-3xl">{insufficientData && acuteLoad === 0 ? '--' : displayAcuteLoad.toLocaleString()}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-subtle/70 uppercase font-black tracking-[0.08em] sm:tracking-widest sm:text-subtle/60">Baseline</p>
                <p className="text-2xl font-black text-strong tracking-tight sm:text-3xl">
                  {insufficientData || isInitialPhase ? '--' : displayChronicLoad.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-6 sm:pt-8 border-t border-[var(--color-border)]">
            <p className="text-sm text-muted leading-relaxed max-w-3xl sm:text-base">
              <span className="font-bold text-strong uppercase tracking-[0.06em] text-xs mr-2 sm:tracking-wider">Coach Insight:</span> {
                getStatusDescription(status, numericRatio, insufficientData, isInitialPhase)
              }
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
