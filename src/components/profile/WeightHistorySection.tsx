'use client'

import React, { useState } from 'react'
import { Ruler } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'

interface WeightEntry {
  id: string
  weight_lb: number
  recorded_at: string
}

interface WeightHistorySectionProps {
  history: WeightEntry[]
  loading: boolean
  deletingId: string | null
  onLogNew: () => void
  onEdit: (entry: WeightEntry) => void
  onDelete: (id: string) => void
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function WeightHistorySection({
  history,
  loading,
  deletingId,
  onLogNew,
  onEdit,
  onDelete
}: WeightHistorySectionProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'
  const [entryToDelete, setEntryToDelete] = useState<WeightEntry | null>(null)

  const handleConfirmDelete = () => {
    if (entryToDelete) {
      onDelete(entryToDelete.id)
      setEntryToDelete(null)
    }
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ruler className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-strong">Body Weight History</h2>
              <p className="text-xs text-subtle">Manage independent weight logs.</p>
            </div>
          </div>
          <Button type="button" size="sm" onClick={onLogNew}>
            Log Weight
          </Button>
        </div>

        <div className="mt-6">
          <div className="space-y-2">
            {loading ? (
              <p className="text-xs text-muted">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted">No manual entries yet.</p>
            ) : (
              history.map((entry) => {
                const displayVal = isKg ? Math.round(entry.weight_lb * KG_PER_LB * 10) / 10 : entry.weight_lb
                return (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3 text-xs">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-strong text-sm">{displayVal} {displayUnit}</span>
                      <span className="text-subtle">{formatDate(entry.recorded_at)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 px-3" onClick={() => onEdit(entry)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                        onClick={() => setEntryToDelete(entry)}
                        disabled={deletingId === entry.id}
                      >
                        {deletingId === entry.id ? '...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        isOpen={Boolean(entryToDelete)}
        onClose={() => setEntryToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Weight Entry"
        description="Are you sure you want to delete this weight entry? This cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={Boolean(entryToDelete && deletingId === entryToDelete.id)}
      />
    </>
  )
}
