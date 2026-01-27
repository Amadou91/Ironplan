'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { resetWorkoutsAction } from '@/app/admin/actions'
import { toast } from 'sonner' // Assuming sonner or similar toast, checking generic Toast usage in project
// Checking project for Toast component usage... 
// src/components/ui/Toast.tsx exists.

export function ResetWorkoutsButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleReset = async () => {
    if (confirmText !== 'RESET WORKOUTS') return

    setIsLoading(true)
    try {
      const res = await resetWorkoutsAction()
      if (res.success) {
        setResult(`Success! Reset ${res.count} exercises.`)
        setIsOpen(false)
        setConfirmText('')
      } else {
        setResult(`Error: ${res.error}`)
      }
    } catch (e) {
      setResult('An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        className="border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
        onClick={() => setIsOpen(true)}
      >
        <AlertTriangle className="mr-2 h-4 w-4" />
        Reset to Defaults
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-6 shadow-2xl border border-[var(--color-border)]">
        <div className="mb-4 flex items-center gap-3 text-[var(--color-danger)]">
          <AlertTriangle className="h-6 w-6" />
          <h2 className="text-xl font-bold">Dangerous Action</h2>
        </div>
        
        <p className="mb-4 text-[var(--color-text-muted)]">
          This will <strong className="text-[var(--color-text)]">permanently delete all exercises</strong> and reset the catalog to the default dataset.
          Any custom exercises created by users (if stored in this table) will be lost.
        </p>

        <p className="mb-2 text-sm font-medium">
          Type <span className="font-mono font-bold text-[var(--color-text)]">RESET WORKOUTS</span> to confirm:
        </p>
        
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESET WORKOUTS"
          className="mb-6 border-[var(--color-danger)]/50 focus:border-[var(--color-danger)]"
        />

        {result && <p className="mb-4 text-sm font-semibold">{result}</p>}

        <div className="flex justify-end gap-3">
          <Button 
            variant="ghost" 
            onClick={() => {
              setIsOpen(false)
              setConfirmText('')
              setResult(null)
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
            onClick={handleReset}
            disabled={confirmText !== 'RESET WORKOUTS' || isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm Reset
          </Button>
        </div>
      </div>
    </div>
  )
}
