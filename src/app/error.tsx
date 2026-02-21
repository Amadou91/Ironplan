'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AppState } from '@/components/ui/AppState'

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled error:', error)
  }, [error])

  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-3xl items-center px-4">
        <AppState
          icon={<AlertTriangle className="h-6 w-6 text-[var(--color-danger)]" aria-hidden="true" />}
          title="Something went wrong"
          description="An unexpected error interrupted this screen. Retry now and continue where you left off."
          actions={
            <Button onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          }
        />
      </div>
    </div>
  )
}
