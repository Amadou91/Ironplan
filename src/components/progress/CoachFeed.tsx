'use client'

import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { CoachInsight } from '@/lib/progress/coach-feed'

type CoachFeedProps = {
  insights: CoachInsight[]
  timeHorizonLabel: string
  focusLabel: string
  drilldownVisible: boolean
  onToggleDrilldown: () => void
}

const TONE_STYLES: Record<CoachInsight['tone'], { badge: string; border: string; text: string; label: string }> = {
  critical: {
    badge: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
    border: 'border-t-[var(--color-danger)]',
    text: 'text-[var(--color-danger)]',
    label: 'Critical'
  },
  warning: {
    badge: 'bg-[var(--color-warning-soft,#fef3c7)] text-[var(--color-warning-strong,#92400e)] border-[var(--color-warning-border,#d97706)]',
    border: 'border-t-[var(--color-warning)]',
    text: 'text-[var(--color-warning-strong,#92400e)]',
    label: 'Watch'
  },
  opportunity: {
    badge: 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] border-[var(--color-primary-border)]',
    border: 'border-t-[var(--color-primary)]',
    text: 'text-[var(--color-primary-strong)]',
    label: 'Opportunity'
  },
  positive: {
    badge: 'bg-[var(--color-success-soft)] text-[var(--color-success-strong)] border-[var(--color-success-border)]',
    border: 'border-t-[var(--color-success)]',
    text: 'text-[var(--color-success-strong)]',
    label: 'On Track'
  }
}

const CONFIDENCE_STYLES: Record<CoachInsight['confidence'], string> = {
  high: 'text-[var(--color-success-strong)]',
  medium: 'text-[var(--color-primary-strong)]',
  low: 'text-[var(--color-warning-strong,#92400e)]'
}

export function CoachFeed({
  insights,
  timeHorizonLabel,
  focusLabel,
  drilldownVisible,
  onToggleDrilldown
}: CoachFeedProps) {
  return (
    <Card className="glass-panel border-[var(--color-border)]">
      <div className="border-b border-[var(--color-border)] px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-black tracking-tight text-strong uppercase">Action Plan</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-subtle">Forward actions from recent training</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-subtle">
              {timeHorizonLabel}
            </span>
            <span className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-subtle">
              {focusLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
        {insights.map((insight) => {
          const tone = TONE_STYLES[insight.tone]
          const confidenceText = CONFIDENCE_STYLES[insight.confidence]
          return (
            <article
              key={insight.id}
              className={`rounded-xl border border-[var(--color-border)] border-t-4 bg-[var(--color-surface-subtle)] p-4 ${tone.border}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${tone.badge}`}>
                  {tone.label}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider ${confidenceText}`}>
                  {insight.confidence} confidence
                </span>
              </div>
              <h3 className="text-sm font-black uppercase tracking-wide text-strong">{insight.title}</h3>
              <p className="mt-2 text-sm text-subtle">{insight.summary}</p>
              <p className="mt-2 text-xs font-semibold text-subtle">Why now: {insight.whyNow}</p>
              <p className={`mt-3 text-xs font-bold uppercase tracking-wide ${tone.text}`}>Next: {insight.nextStep}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">{insight.metric}</p>
            </article>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-4">
        <p className="text-xs text-subtle">Actions use recent data. Drilldown charts follow your selected date filters.</p>
        <Button type="button" variant="secondary" onClick={onToggleDrilldown} className="h-10 px-4 text-xs font-black uppercase tracking-widest">
          {drilldownVisible ? 'Hide drilldown' : 'Show full drilldown'}
          {drilldownVisible ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </Card>
  )
}
