'use client'

import React from 'react'
import { Ruler } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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
  return (
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
            history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3 text-xs">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-strong text-sm">{entry.weight_lb} lb</span>
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
                    onClick={() => onDelete(entry.id)}
                    disabled={deletingId === entry.id}
                  >
                    {deletingId === entry.id ? '...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  )
}
