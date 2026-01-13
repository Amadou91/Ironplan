import type { GeneratedPlan } from '@/types/domain'

export type WorkoutHistoryItem = {
  id: string
  createdAt: string
  title: string
  description: string
  plan: GeneratedPlan
}

const HISTORY_KEY = 'ironplan:workout-history'

export const readHistory = (storage: Storage): WorkoutHistoryItem[] => {
  const raw = storage.getItem(HISTORY_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as WorkoutHistoryItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (error) {
    console.warn('Failed to parse workout history', error)
    return []
  }
}

export const writeHistory = (storage: Storage, items: WorkoutHistoryItem[]) => {
  storage.setItem(HISTORY_KEY, JSON.stringify(items))
}

export const saveHistoryItem = (storage: Storage, item: WorkoutHistoryItem, limit = 20) => {
  const history = readHistory(storage)
  const next = [item, ...history.filter(existing => existing.id !== item.id)].slice(0, limit)
  writeHistory(storage, next)
  return next
}
