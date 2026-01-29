'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { WorkoutHistoryEntry } from '@/lib/workoutHistory'

interface TemplateHistoryProps {
  historyEntries: WorkoutHistoryEntry[]
  onLoadHistory: (entry: WorkoutHistoryEntry) => void
  onDeleteHistory: (entry: WorkoutHistoryEntry) => Promise<void>
  onStartSession: (params: { templateId: string; sessionKey: string }) => void
  startingSessionKey: string | null
  historyError: string | null
  startSessionError: string | null
  deletingHistoryIds: Record<string, boolean>
}

export function TemplateHistory({
  historyEntries,
  onLoadHistory,
  onDeleteHistory,
  onStartSession,
  startingSessionKey,
  historyError,
  startSessionError,
  deletingHistoryIds
}: TemplateHistoryProps) {
  const [entryToDelete, setEntryToDelete] = useState<WorkoutHistoryEntry | null>(null)

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return
    await onDeleteHistory(entryToDelete)
    setEntryToDelete(null)
  }

  return (
    <>
      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-strong">Saved Templates</h2>
            <p className="text-xs text-subtle">Quickly reload a recently saved template.</p>
          </div>
        </div>

        {startSessionError && <p className="mb-3 text-sm text-[var(--color-danger)]">{startSessionError}</p>}
        {historyError && <p className="mb-3 text-sm text-[var(--color-danger)]">{historyError}</p>}

        {historyEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-sm text-muted">
            No saved templates yet. Save a template to start building your history.
          </div>
        ) : (
          <div className="space-y-3">
            {historyEntries.map((entry) => {
              const entryTitle = buildWorkoutDisplayName({
                focus: entry.template.focus,
                style: entry.template.style,
                intensity: entry.template.inputs.intensity,
                fallback: entry.title
              })
              return (
                <div
                  key={entry.id}
                  className="surface-card-muted flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-strong">{entryTitle}</p>
                    <p className="text-xs text-subtle">Saved {new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onLoadHistory(entry)}
                      className="px-3 py-2 text-xs"
                    >
                      Reload Setup
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        if (!entry.remoteId) return
                        onStartSession({
                          templateId: entry.remoteId,
                          sessionKey: `${entry.id}-start`
                        })
                      }}
                      className="px-3 py-2 text-xs"
                      disabled={!entry.remoteId || startingSessionKey === `${entry.id}-start`}
                    >
                      {startingSessionKey === `${entry.id}-start` ? 'Starting...' : 'Start Session'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setEntryToDelete(entry)}
                      className="px-3 py-2 text-xs border border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      variant="outline"
                      disabled={Boolean(deletingHistoryIds[entry.id])}
                    >
                      {deletingHistoryIds[entry.id] ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={Boolean(entryToDelete)}
        onClose={() => setEntryToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Saved Template"
        description="Are you sure you want to delete this template from your history? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={entryToDelete ? Boolean(deletingHistoryIds[entryToDelete.id]) : false}
      />
    </>
  )
}
