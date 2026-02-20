'use client'

import React, { useState } from 'react'
import { Ruler, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'
import { useRouter } from 'next/navigation'

interface WeightEntry {
  id: string
  weight_lb: number
  recorded_at: string
  source: string
  session_id: string | null
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
  const router = useRouter()
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
              <p className="text-xs text-muted">No entries yet.</p>
            ) : (
              history.map((entry) => {
                const displayVal = isKg ? Math.round(entry.weight_lb * KG_PER_LB * 10) / 10 : entry.weight_lb
                const isManual = entry.source === 'user'
                return (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-[var(--color-border)] p-4 text-xs gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="font-black text-strong text-lg tabular-nums">{displayVal} <span className="text-[10px] uppercase font-bold text-muted">{displayUnit}</span></span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            isManual ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]' : 'bg-[var(--color-surface-muted)] text-subtle border border-[var(--color-border)]'
                          }`}>
                            {isManual ? 'Manual Entry' : 'From Session'}
                          </span>
                          <span className="text-subtle font-medium">{formatDate(entry.recorded_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isManual ? (
                        <>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-9 px-3 font-bold" 
                            onClick={() => onEdit(entry)}
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                            onClick={() => setEntryToDelete(entry)}
                            disabled={deletingId === entry.id}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            {deletingId === entry.id ? '...' : 'Delete'}
                          </Button>
                        </>
                      ) : (
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 px-3 font-bold flex-1 sm:flex-none" 
                          onClick={() => {
                            if (entry.session_id) {
                              router.push(`/exercises/summary?sessionId=${entry.session_id}`)
                            }
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          View Session
                        </Button>
                      )}
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
