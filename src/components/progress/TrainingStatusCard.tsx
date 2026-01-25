'use client'

import { Card } from '@/components/ui/Card'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'

interface TrainingStatusCardProps {
  status: string
  loadRatio: number | string
  weeklyLoad: number
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
  weeklyLoad,
  chronicWeeklyAvg,
  insufficientData,
  isInitialPhase
}: TrainingStatusCardProps) {
  const numericRatio = typeof loadRatio === 'number' ? loadRatio : parseFloat(loadRatio) || 0

  return (
    <Card className={`relative z-10 border-t-4 ${
      insufficientData || isInitialPhase ? 'border-t-[var(--color-border)]' :
      status === 'balanced' ? 'border-t-[var(--color-success)]' :
      status === 'overreaching' ? 'border-t-[var(--color-danger)]' :
      'border-t-[var(--color-warning)]'
    }`}>
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-strong">Systemic Training Status</h3>
                <ChartInfoTooltip 
                  description="The ratio between your Acute Load (Last 7 days) and Chronic Load (Last 28 days). It indicates if you are ramping up too fast or doing too little."
                  goal="Stay in the Green (Balanced) zone most of the time to get stronger without getting hurt."
                />
              </div>
              <p className="text-[9px] text-muted italic mt-0.5">Based on total body workload</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${
                insufficientData || isInitialPhase ? 'bg-[var(--color-surface-muted)] text-subtle border-[var(--color-border)]' :
                status === 'balanced' ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success-border)]' :
                status === 'overreaching' ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger-border)]' :
                status === 'undertraining' ? 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a] dark:bg-[#92400e]/20 dark:text-[#fcd34d] dark:border-[#92400e]/40' :
                'bg-[var(--color-surface-muted)] text-subtle border border-[var(--color-border)]'
              }`}>
                {insufficientData ? 'Insufficient Data' :
                 isInitialPhase ? 'Building Baseline' :
                 status === 'overreaching' ? 'overtraining' : status.replace('_', ' ')}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-4 lg:items-center">
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tighter text-strong">
                  {insufficientData || isInitialPhase ? '--' : loadRatio}
                </span>
                <span className="text-xs font-bold text-subtle uppercase tracking-widest">ACR</span>
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-subtle/70">Acute:Chronic Ratio</p>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="relative pt-2">
                <div className="h-3 w-full bg-[var(--color-surface-muted)] rounded-full overflow-hidden flex shadow-inner">
                  <div className="h-full bg-[var(--color-warning)] opacity-30" style={{ width: '40%' }} />
                  <div className="h-full bg-[var(--color-success)] opacity-40" style={{ width: '25%' }} />
                  <div className="h-full bg-[var(--color-danger)] opacity-30" style={{ width: '35%' }} />
                </div>
                {!insufficientData && !isInitialPhase && (
                  <div 
                    className={`absolute top-1.5 h-5 w-1.5 rounded-full transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) shadow-lg border border-white dark:border-gray-900 ${
                      status === 'balanced' ? 'bg-[var(--color-success)]' :
                      status === 'overreaching' ? 'bg-[var(--color-danger)]' :
                      'bg-[#92400e]'
                    }`}
                    style={{
                      left: `${Math.min(100, (numericRatio / 2.0) * 100)}%`,
                      transform: 'translateX(-50%)'
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between px-1">
                <div className="text-center">
                  <span className="block text-[9px] font-bold text-subtle/40 uppercase">Low</span>
                  <span className="text-[10px] font-bold text-subtle">0.0</span>
                </div>
                <div className="text-center">
                  <span className="block text-[9px] font-bold text-[var(--color-success)]/60 uppercase">Sweet Spot</span>
                  <span className="text-[10px] font-bold text-subtle">1.0</span>
                </div>
                <div className="text-center">
                  <span className="block text-[9px] font-bold text-[var(--color-danger)]/60 uppercase">High</span>
                  <span className="text-[10px] font-bold text-subtle">2.0+</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:border-l lg:border-[var(--color-border)] lg:pl-10">
              <div className="space-y-1">
                <p className="text-[10px] text-subtle uppercase font-bold tracking-widest">Load (7d)</p>
                <p className="text-2xl font-bold text-strong tracking-tight">{insufficientData && weeklyLoad === 0 ? '--' : weeklyLoad.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-subtle uppercase font-bold tracking-widest">Baseline</p>
                <p className="text-2xl font-bold text-strong tracking-tight">
                  {insufficientData || isInitialPhase ? '--' : chronicWeeklyAvg.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-6 border-t border-[var(--color-border)]/50">
            <p className="text-sm text-muted leading-relaxed">
              <span className="font-semibold text-strong">Coach Insight:</span> {
                getStatusDescription(status, numericRatio, insufficientData, isInitialPhase)
              }
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
