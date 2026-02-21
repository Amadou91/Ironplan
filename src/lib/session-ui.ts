export type SessionSyncStatus = {
  state: 'pending' | 'synced' | 'error'
  pending: number
  error: number
}

export function getSessionCompletionPct(progress?: {
  completedSets: number
  totalSets: number
} | null): number {
  if (!progress?.totalSets || progress.totalSets <= 0) return 0
  const pct = Math.round((progress.completedSets / progress.totalSets) * 100)
  return Math.max(0, Math.min(100, pct))
}

export function formatSessionSyncLabel(syncStatus?: SessionSyncStatus | null, isOnline = true): {
  label: string | null
  tone: 'warning' | 'danger' | 'primary' | 'success'
} {
  if (!isOnline) {
    return { label: 'Offline: changes saved locally', tone: 'warning' }
  }

  if (!syncStatus) {
    return { label: null, tone: 'success' }
  }

  if (syncStatus.state === 'error') {
    return { label: `Sync issue (${syncStatus.error})`, tone: 'danger' }
  }

  if (syncStatus.state === 'pending') {
    return {
      label: `Syncing ${syncStatus.pending} change${syncStatus.pending === 1 ? '' : 's'}`,
      tone: 'primary'
    }
  }

  return { label: 'All changes synced', tone: 'success' }
}
