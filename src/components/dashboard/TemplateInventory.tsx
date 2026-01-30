'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Dumbbell, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildTemplateDisplayName } from '@/lib/workout-naming'
import { SessionSetupModal } from '@/components/dashboard/SessionSetupModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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
  const [activeTemplate, setActiveTemplate] = useState<TemplateRow | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<TemplateRow | null>(null)

  const handleStartClick = (template: TemplateRow) => {
    setActiveTemplate(template)
  }

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return
    await onDeleteTemplate(templateToDelete)
    setTemplateToDelete(null)
  }

  return (
    <>
      <Card className="p-8 md:p-10 lg:p-12">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-strong shadow-sm">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-strong uppercase tracking-wider">Your Templates</h2>
              <p className="text-sm text-muted">Saved workout structures for quick starts.</p>
            </div>
          </div>
          <Link href="/generate">
            <Button variant="ghost" size="md" className="text-accent font-bold">
              <Plus className="h-5 w-5 mr-2" /> New Template
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center text-base text-muted">
              No templates found.
            </div>
          ) : (
            templates.map((template) => {
              const isRecommended = recommendedTemplateId === template.id
              const displayTitle = buildTemplateDisplayName({
                focus: template.focus,
                fallback: template.title
              })
              return (
                <div
                  key={template.id}
                  className="flex flex-col rounded-2xl border border-[var(--color-border)] p-6 transition-all hover:border-[var(--color-primary-border)] hover:bg-[var(--color-surface-subtle)] hover:shadow-md"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-lg font-bold text-strong truncate">{displayTitle}</p>
                      {isRecommended && (
                        <span className="flex-shrink-0 rounded bg-[var(--color-success-soft)] px-2 py-1 text-[10px] font-black uppercase text-[var(--color-success)] border border-[var(--color-success-border)]">
                          Best
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-subtle uppercase font-bold tracking-widest">
                      {template.style.replace('_', ' ')} · {template.focus}
                    </p>
                  </div>

                  <div className="mt-8 flex items-center justify-between pt-5 border-t border-[var(--color-border)]/50">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="h-10 px-4 text-xs font-bold"
                        onClick={() => handleStartClick(template)}
                      >
                        Start
                      </Button>
                      <Link href={`/workout/${template.id}?from=dashboard`}>
                        <Button variant="secondary" size="sm" className="h-10 px-4 text-xs font-bold">
                          Preview
                        </Button>
                      </Link>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      onClick={() => setTemplateToDelete(template)}
                      disabled={Boolean(deletingWorkoutIds[template.id])}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {activeTemplate && (
        <SessionSetupModal 
          isOpen={Boolean(activeTemplate)}
          onClose={() => setActiveTemplate(null)}
          templateId={activeTemplate.id}
          templateTitle={buildTemplateDisplayName({
            focus: activeTemplate.focus,
            fallback: activeTemplate.title
          })}
          templateFocus={activeTemplate.focus}
          templateStyle={activeTemplate.style}
          templateIntensity={activeTemplate.intensity}
          templateInputs={activeTemplate.template_inputs}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(templateToDelete)}
        onClose={() => setTemplateToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        description={`Are you sure you want to delete "${templateToDelete?.title ?? 'this template'}"? This action cannot be undone.`}
        confirmText="Delete Forever"
        variant="danger"
        isLoading={templateToDelete ? Boolean(deletingWorkoutIds[templateToDelete.id]) : false}
      />
    </>
  )
}
