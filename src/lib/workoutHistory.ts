import type { WorkoutTemplateDraft } from '@/types/domain'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'

export type WorkoutHistoryEntry = {
  id: string
  title: string
  createdAt: string
  template: WorkoutTemplateDraft
  remoteId?: string
}

const HISTORY_KEY = 'ironplan.workoutHistory'
const MAX_ENTRIES = 12

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isValidHistoryEntry = (entry: unknown): entry is WorkoutHistoryEntry => {
  if (!isRecord(entry)) return false
  if (typeof entry.id !== 'string') return false
  if (typeof entry.title !== 'string') return false
  if (typeof entry.createdAt !== 'string') return false
  if (!isRecord(entry.template)) return false
  if (!('inputs' in entry.template) || !isRecord(entry.template.inputs)) return false
  return true
}

export const loadWorkoutHistory = (storage?: Storage): WorkoutHistoryEntry[] => {
  if (!storage) return []
  try {
    const raw = storage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WorkoutHistoryEntry[]
    if (!Array.isArray(parsed)) return []
    const sanitized = parsed.filter(isValidHistoryEntry)
    if (sanitized.length !== parsed.length) {
      storage.setItem(HISTORY_KEY, JSON.stringify(sanitized))
    }
    return sanitized
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

export const setWorkoutHistoryEntries = (entries: WorkoutHistoryEntry[], storage?: Storage) => {
  if (!storage) return
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch (error) {
    console.error('Failed to set workout history', error)
  }
}

export const removeWorkoutHistoryEntry = (entryId: string, storage?: Storage) => {
  if (!storage) return
  try {
    const current = loadWorkoutHistory(storage)
    const next = current.filter(item => item.id !== entryId)
    storage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch (error) {
    console.error('Failed to remove workout history entry', error)
  }
}

export const buildWorkoutHistoryEntry = (template: WorkoutTemplateDraft, remoteId?: string): WorkoutHistoryEntry => ({
  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: buildWorkoutDisplayName({
    focus: template.focus,
    style: template.style,
    intensity: template.inputs.intensity,
    fallback: template.title
  }),
  createdAt: new Date().toISOString(),
  template,
  remoteId
})
