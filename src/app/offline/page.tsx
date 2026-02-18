'use client'

import { RotateCcw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function OfflinePage() {
  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <WifiOff className="h-8 w-8 text-[var(--color-danger)]" />
        </div>
        <h1 className="text-2xl font-semibold text-strong">You are offline</h1>
        <p className="mt-2 text-sm text-muted">
          Keep training. Your workout inputs remain available, and updates resume when your connection returns.
        </p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  )
}
