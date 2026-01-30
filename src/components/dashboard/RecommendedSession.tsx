'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, Sparkles, Moon, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { SessionSetupModal } from '@/components/dashboard/SessionSetupModal'
import type { TemplateRow } from '@/hooks/useDashboardData'

type TrainingLoadStatus = 'balanced' | 'undertraining' | 'overreaching'

interface RecommendedSessionProps {
  recommendedTemplate: TemplateRow | undefined
  trainingLoadStatus?: TrainingLoadStatus
  loadRatio?: number
}

export function RecommendedSession({ recommendedTemplate, trainingLoadStatus, loadRatio }: RecommendedSessionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [dismissedRestSuggestion, setDismissedRestSuggestion] = useState(false)
  
  const shouldSuggestRest = trainingLoadStatus === 'overreaching' && !dismissedRestSuggestion
  const isHighRisk = loadRatio !== undefined && loadRatio >= 1.5

  const handleStartClick = () => {
    setIsModalOpen(true)
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-8 md:p-12">
          {shouldSuggestRest ? (
            // Rest day suggestion when ACR indicates overreaching
            <>
              <div className="flex items-center gap-4 mb-8">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ${
                  isHighRisk 
                    ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]' 
                    : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                }`}>
                  {isHighRisk ? <AlertTriangle className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-strong uppercase tracking-wider">
                    {isHighRisk ? 'Rest Day Strongly Recommended' : 'Consider a Rest Day'}
                  </h2>
                  <p className="text-sm text-muted">
                    Your ACR is {loadRatio?.toFixed(2) ?? 'elevated'} — {isHighRisk ? 'high injury risk zone' : 'you may be overreaching'}.
                  </p>
                </div>
              </div>

              <div className={`rounded-2xl border p-8 ${
                isHighRisk 
                  ? 'border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]' 
                  : 'border-[var(--color-warning-border)] bg-[var(--color-warning-soft)]'
              }`}>
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                        isHighRisk 
                          ? 'bg-[var(--color-danger)] text-white' 
                          : 'bg-[var(--color-warning)] text-white'
                      }`}>
                        {isHighRisk ? 'High Risk' : 'Caution'}
                      </span>
                      <p className="text-lg font-semibold text-strong">
                        Recovery Day
                      </p>
                    </div>
                    <p className="text-sm text-muted max-w-md">
                      {isHighRisk 
                        ? 'Your training load is significantly elevated. Taking a rest day will help prevent injury and improve long-term progress.'
                        : 'Your acute training load is higher than usual. A rest day or light activity can help you recover and perform better.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      variant="secondary" 
                      className="h-11 px-6"
                      onClick={() => setDismissedRestSuggestion(true)}
                    >
                      Train Anyway
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Normal workout recommendation
            <>
              <div className="flex items-center gap-4 mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-sm">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-strong uppercase tracking-wider">Recommended for you</h2>
                  <p className="text-sm text-muted">Intelligent suggestion based on your training history.</p>
                </div>
              </div>

              {recommendedTemplate ? (
            <div className="group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-8 transition-all hover:border-[var(--color-primary-border)] hover:bg-[var(--color-surface)] hover:shadow-md">
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="badge-success text-[11px]">Best for Today</span>
                    <p className="text-2xl font-bold text-strong">
                      {buildWorkoutDisplayName({
                        focus: recommendedTemplate.focus,
                        style: recommendedTemplate.style,
                        intensity: recommendedTemplate.intensity,
                        fallback: recommendedTemplate.title
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="h-4 w-4" />
                      {recommendedTemplate.template_inputs?.time?.minutesPerSession ?? 45} min
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/workout/${recommendedTemplate.id}`}>
                    <Button variant="secondary" className="h-11 px-6">
                      Preview
                    </Button>
                  </Link>
                  <Button 
                    onClick={handleStartClick}
                    className="h-11 px-8 shadow-lg shadow-[var(--color-primary-soft)]"
                  >
                    Start Workout
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[var(--color-border)] p-10 text-center">
              <p className="text-sm text-muted">Build your first plan to unlock daily recommendations.</p>
              <Link href="/generate" className="mt-4 inline-block">
                <Button variant="outline" size="sm">
                  Create Plan
                </Button>
              </Link>
            </div>
          )}
            </>
          )}
        </div>
      </Card>

      {recommendedTemplate && (
        <SessionSetupModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          templateId={recommendedTemplate.id}
          templateTitle={buildWorkoutDisplayName({
            focus: recommendedTemplate.focus,
            style: recommendedTemplate.style,
            intensity: recommendedTemplate.intensity,
            fallback: recommendedTemplate.title
          })}
          templateFocus={recommendedTemplate.focus}
          templateStyle={recommendedTemplate.style}
          templateIntensity={recommendedTemplate.intensity}
          templateInputs={recommendedTemplate.template_inputs}
        />
      )}
    </>
  )
}
