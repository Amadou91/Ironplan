import type { GeneratedPlan } from '@/types/domain'

export type WorkoutHistoryEntry = {
  id: string
  title: string
  createdAt: string
  plan: GeneratedPlan
  remoteId?: string
}

const HISTORY_KEY = 'ironplan.workoutHistory'
const MAX_ENTRIES = 12

export const loadWorkoutHistory = (storage?: Storage): WorkoutHistoryEntry[] => {
  if (!storage) return []
  try {
    const raw = storage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WorkoutHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to load workout history', error)
    return []
  }
}

export const saveWorkoutHistoryEntry = (entry: WorkoutHistoryEntry, storage?: Storage) => {
  if (!storage) return
  try {
    const current = loadWorkoutHistory(storage)
    const next = [entry, ...current.filter(item => item.id !== entry.id)].slice(0, MAX_ENTRIES)
    storage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch (error) {
    console.error('Failed to save workout history', error)
  }
}

export const buildWorkoutHistoryEntry = (plan: GeneratedPlan, remoteId?: string): WorkoutHistoryEntry => ({
  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: plan.title,
  createdAt: new Date().toISOString(),
  plan,
  remoteId
})
