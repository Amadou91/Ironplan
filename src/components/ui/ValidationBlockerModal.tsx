'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { SetValidationError } from '@/lib/session-validation'

interface ValidationBlockerModalProps {
  isOpen: boolean
  onClose: () => void
  errors: SetValidationError[]
  hasNoCompletedSets: boolean
}

/**
 * A blocking modal that prevents saving a workout when required fields are missing.
 * Displays a clear list of the missing fields that must be completed.
 */
export function ValidationBlockerModal({
  isOpen,
  onClose,
  errors,
  hasNoCompletedSets
}: ValidationBlockerModalProps) {
  const dialogRef = useFocusTrap(isOpen)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Group errors by exercise for cleaner display
  const errorsByExercise = new Map<string, SetValidationError[]>()
  for (const error of errors) {
    const existing = errorsByExercise.get(error.exerciseName) ?? []
    existing.push(error)
    errorsByExercise.set(error.exerciseName, existing)
  }

  // Backdrop click handler that avoids closing when dragging from inside the modal to outside
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const handleMouseUp = (upEvent: MouseEvent) => {
        if (upEvent.target === e.currentTarget) {
          onClose()
        }
        document.removeEventListener('mouseup', handleMouseUp)
      }
      document.addEventListener('mouseup', handleMouseUp)
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200',
        'bg-black/60 backdrop-blur-sm'
      )}
      onMouseDown={handleMouseDown}
    >
      <div
        ref={dialogRef}
        className={cn(
          'w-full max-w-lg bg-[var(--color-surface)] rounded-3xl shadow-2xl',
          'border border-[var(--color-border-strong)] overflow-hidden',
          'transform scale-100 opacity-100'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-blocker-title"
      >
        <div className="relative p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center gap-4">
            <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 id="validation-blocker-title" className="text-xl font-bold text-[var(--color-text)]">
                {hasNoCompletedSets ? 'No Sets Logged' : 'Missing Required Fields'}
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {hasNoCompletedSets
                  ? 'You must complete at least one set before finishing the workout.'
                  : 'The following sets have incomplete required fields. Please fill them in before saving.'}
              </p>
            </div>
          </div>

          {!hasNoCompletedSets && errors.length > 0 && (
            <div className="mt-6 max-h-64 overflow-y-auto">
              <div className="space-y-3">
                {Array.from(errorsByExercise.entries()).map(([exerciseName, exerciseErrors]) => (
                  <div
                    key={exerciseName}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4"
                  >
                    <h3 className="font-semibold text-sm text-[var(--color-text)]">
                      {exerciseName}
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {exerciseErrors.map((error) => (
                        <li
                          key={`${error.exerciseIndex}-${error.setNumber}`}
                          className="text-xs text-[var(--color-text-muted)] flex items-start gap-2"
                        >
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>
                            <span className="font-medium text-[var(--color-text-subtle)]">
                              Set {error.setNumber}:
                            </span>{' '}
                            Missing {error.missingFields.join(', ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <Button
              onClick={onClose}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
            >
              Go Back and Complete
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
