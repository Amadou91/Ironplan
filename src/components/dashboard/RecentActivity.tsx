'use client'

import { useEffect, useMemo, useState } from 'react'
import { SessionHistoryList } from '@/components/progress/SessionHistoryList'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import type { SessionRow } from '@/hooks/useDashboardData'
import type { SessionRow as ProgressSessionRow } from '@/lib/transformers/progress-data'

interface RecentActivityProps {
  recentSessions: SessionRow[]
}

export function RecentActivity({ recentSessions }: RecentActivityProps) {
  const { catalog } = useExerciseCatalog()
  const exerciseLibraryByName = useMemo(
    () =>
      new Map(
        catalog.filter((exercise) => exercise.name).map((exercise) => [exercise.name.toLowerCase(), exercise])
      ),
    [catalog]
  )

  const normalizedSessions = useMemo(
    () => recentSessions as unknown as ProgressSessionRow[],
    [recentSessions]
  )

  const [visibleSessions, setVisibleSessions] = useState<ProgressSessionRow[]>(normalizedSessions)

  useEffect(() => {
    setVisibleSessions(normalizedSessions)
  }, [normalizedSessions])

  return (
    <SessionHistoryList
      sessions={visibleSessions}
      exerciseLibraryByName={exerciseLibraryByName}
      getSessionTitle={(session) => session.name}
      hasMore={false}
      onLoadMore={() => null}
      onDeleteSuccess={(id) => setVisibleSessions((prev) => prev.filter((session) => session.id !== id))}
      onError={() => null}
      loading={false}
      showActions={false}
      showImportExport={false}
    />
  )
}
