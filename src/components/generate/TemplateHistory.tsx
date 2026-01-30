'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildTemplateDisplayName } from '@/lib/workout-naming'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SessionSetupModal } from '@/components/dashboard/SessionSetupModal'
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
  historyError,
  deletingHistoryIds
}: TemplateHistoryProps) {
  const [entryToDelete, setEntryToDelete] = useState<WorkoutHistoryEntry | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<WorkoutHistoryEntry | null>(null)

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return
    await onDeleteHistory(entryToDelete)
    setEntryToDelete(null)
  }

  const handleStartClick = (entry: WorkoutHistoryEntry) => {
    if (!entry.remoteId) return
    setSelectedEntry(entry)
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

        {historyError && <p className="mb-3 text-sm text-[var(--color-danger)]">{historyError}</p>}

        {historyEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-sm text-muted">
            No saved templates yet. Save a template to start building your history.
          </div>
        ) : (
          <div className="space-y-3">
            {historyEntries.map((entry) => {
              const entryTitle = buildTemplateDisplayName({
                focus: entry.template.focus,
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
                      onClick={() => handleStartClick(entry)}
                      className="px-3 py-2 text-xs"
                      disabled={!entry.remoteId}
                    >
                      Start Session
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

      {selectedEntry?.remoteId && (
        <SessionSetupModal
          isOpen={Boolean(selectedEntry)}
          onClose={() => setSelectedEntry(null)}
          templateId={selectedEntry.remoteId}
          templateTitle={buildTemplateDisplayName({
            focus: selectedEntry.template.focus,
            fallback: selectedEntry.title
          })}
          templateFocus={selectedEntry.template.focus}
          templateStyle={selectedEntry.template.style}
          templateIntensity={selectedEntry.template.inputs.intensity}
          templateInputs={selectedEntry.template.inputs}
        />
      )}
    </>
  )
}
