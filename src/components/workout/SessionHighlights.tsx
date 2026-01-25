import React from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface SessionHighlightsProps {
  impactScore?: number | null
  impactBreakdown?: {
    volume?: number
    intensity?: number
  } | null
  effortInsight?: string | null
  metrics: {
    totalSets: number
    totalReps: number
    workload: number
    tonnage: number
    hardSets: number
    bestE1rm: number
    avgEffort: number | null
    avgIntensity: number | null
    avgRestSeconds: number | null
    density: number | null
    sRpeLoad: number | null
  }
}

export function SessionHighlights({
  impactScore,
  impactBreakdown,
  effortInsight,
  metrics
}: SessionHighlightsProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />
        <h2 className="text-lg font-semibold text-strong">Session highlights</h2>
      </div>
      {impactScore ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="badge-success">Impact score {Math.round(impactScore)}</span>
          <span className="text-subtle">
            Volume {Math.round(impactBreakdown?.volume ?? 0)} · Intensity {Math.round(impactBreakdown?.intensity ?? 0)}
          </span>
        </div>
      ) : null}
      {effortInsight && (
        <p className="mt-2 text-xs text-subtle">{effortInsight}</p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] p-4 text-sm">
          <p className="text-xs text-subtle">Total sets</p>
          <p className="text-2xl font-semibold text-strong">{metrics.totalSets}</p>
          <p className="text-xs text-subtle">{metrics.totalReps} reps logged</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-4 text-sm">
          <p className="text-xs text-subtle">Workload</p>
          <p className="text-2xl font-semibold text-strong">{metrics.workload}</p>
          <p className="text-xs text-subtle">
            {metrics.tonnage} tonnage · {metrics.hardSets} hard sets · sRPE {metrics.sRpeLoad ?? 'N/A'}
          </p>
        </div>
        {metrics.bestE1rm > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] p-4 text-sm">
            <p className="text-xs text-subtle">Best e1RM</p>
            <p className="text-2xl font-semibold text-strong">{metrics.bestE1rm}</p>
            <p className="text-xs text-subtle">Avg intensity {metrics.avgIntensity ?? 'N/A'}</p>
          </div>
        )}
        <div className="rounded-lg border border-[var(--color-border)] p-4 text-sm">
          <p className="text-xs text-subtle">Average effort</p>
          <p className="text-2xl font-semibold text-strong">
            {metrics.avgEffort ?? 'N/A'}
          </p>
          <p className="text-xs text-subtle">
            Rest {metrics.avgRestSeconds ?? 'N/A'}s · Density {metrics.density ?? 'N/A'}
          </p>
        </div>
      </div>
    </Card>
  )
}
