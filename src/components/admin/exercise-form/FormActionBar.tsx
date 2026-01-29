'use client'

import { Save, X, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Props = {
  isSubmitting: boolean
  onSubmit: () => void
  onCancel: () => void
}

/**
 * Sticky action bar with Cancel/Submit buttons
 */
export function FormActionBar({ isSubmitting, onSubmit, onCancel }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 px-4 py-6 sm:px-8 bg-[var(--color-surface)]/80 backdrop-blur-2xl border-t border-[var(--color-border)] z-50 shadow-[0_-15px_50px_rgba(0,0,0,0.1)]">
      <div className="max-w-5xl w-full mx-auto flex flex-col sm:flex-row justify-end gap-4 sm:gap-6">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onCancel}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bold text-sm h-14 px-8 order-2 sm:order-1"
        >
          <X className="w-5 h-5 mr-2" />
          Cancel
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={isSubmitting}
          className="min-w-[200px] h-14 px-10 shadow-xl shadow-[var(--color-primary-soft)] text-sm font-black uppercase tracking-[0.1em] order-1 sm:order-2"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Settings className="w-5 h-5 animate-spin" />
              Processing...
            </span>
          ) : (
            <>
              <Save className="w-5 h-5 mr-3" />
              Commit to Library
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
