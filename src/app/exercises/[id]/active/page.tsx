'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { WorkoutActiveScreen } from '@/components/workout/WorkoutActiveScreen'
import { AppState } from '@/components/ui/AppState'

function ActiveSessionFallback() {
  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-3xl items-center px-4">
        <AppState
          icon={<Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />}
          title="Loading active session"
          description="Fetching your latest workout data and queued offline changes."
        />
      </div>
    </div>
  )
}

export default function WorkoutActivePage() {
  return (
    <Suspense fallback={<ActiveSessionFallback />}>
      <WorkoutActiveScreen />
    </Suspense>
  )
}
