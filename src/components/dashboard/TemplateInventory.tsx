'use client'

import Link from 'next/link'
import { Dumbbell, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import type { TemplateRow } from '@/hooks/useDashboardData'

interface TemplateInventoryProps {
  templates: TemplateRow[]
  recommendedTemplateId: string | null
  onDeleteTemplate: (template: TemplateRow) => Promise<void>
  deletingWorkoutIds: Record<string, boolean>
}

export function TemplateInventory({
  templates,
  recommendedTemplateId,
  onDeleteTemplate,
  deletingWorkoutIds
}: TemplateInventoryProps) {
  return (
    <Card className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-strong">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-strong uppercase tracking-wider">Your Templates</h2>
            <p className="text-xs text-muted">Saved workout structures for quick starts.</p>
          </div>
        </div>
        <Link href="/generate">
          <Button variant="ghost" size="sm" className="text-accent font-bold">
            <Plus className="h-4 w-4 mr-1.5" /> New Template
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-muted">
            No templates found.
          </div>
        ) : (
          templates.map((template) => {
            const isRecommended = recommendedTemplateId === template.id
            const displayTitle = buildWorkoutDisplayName({
              focus: template.focus,
              style: template.style,
              intensity: template.intensity,
              fallback: template.title
            })
            return (
              <div
                key={template.id}
                className="flex flex-col rounded-xl border border-[var(--color-border)] p-5 transition-all hover:border-[var(--color-primary-border)] hover:bg-[var(--color-surface-subtle)]"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-strong truncate">{displayTitle}</p>
                    {isRecommended && (
                      <span className="flex-shrink-0 rounded bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--color-success)] border border-[var(--color-success-border)]">
                        Best
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-subtle uppercase font-bold tracking-widest">
                    {template.style.replace('_', ' ')} · {template.focus}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between pt-4 border-t border-[var(--color-border)]/50">
                  <div className="flex gap-1.5">
                    <Link href={`/workouts/${template.id}/start`}>
                      <Button size="sm" className="h-8 px-3 text-[11px] font-bold">
                        Start
                      </Button>
                    </Link>
                    <Link href={`/workout/${template.id}?from=dashboard`}>
                      <Button variant="secondary" size="sm" className="h-8 px-3 text-[11px] font-bold">
                        Preview
                      </Button>
                    </Link>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                    onClick={() => onDeleteTemplate(template)}
                    disabled={Boolean(deletingWorkoutIds[template.id])}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
