'use client'

import Link from 'next/link'
import { RotateCcw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AppState } from '@/components/ui/AppState'

export default function OfflinePage() {
  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-3xl items-center px-4">
        <AppState
          icon={<WifiOff className="h-6 w-6 text-[var(--color-danger)]" aria-hidden="true" />}
          title="You are offline"
          description="You can keep logging workouts in the app. We will sync your changes as soon as connection is restored."
          actions={
            <>
              <Button onClick={() => window.location.reload()}>
                <RotateCcw className="h-4 w-4" />
                Retry connection
              </Button>
              <Link href="/dashboard">
                <Button variant="secondary">Open dashboard</Button>
              </Link>
            </>
          }
        />
      </div>
    </div>
  )
}
