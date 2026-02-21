import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkoutSession, WorkoutSet } from '@/types/domain'

export type SetOperationKind = 'upsert' | 'delete'
export type SetSyncState = 'synced' | 'pending' | 'error'

export type SetUpsertPayload = {
  session_exercise_id: string
  set_number: number
  reps: number | null
  weight: number | null
  implement_count: number | null
  load_type: string
  rpe: number | null
  rir: number | null
  completed: boolean
  performed_at: string
  weight_unit: string
  duration_seconds: number | null
  distance: number | null
  distance_unit: string | null
  rest_seconds_actual: number | null
  extras: Record<string, unknown>
  extra_metrics: Record<string, unknown>
}

export type QueuedSetOperation = {
  setId: string
  sessionId: string
  sessionExerciseId: string
  kind: SetOperationKind
  opId: string
  attempts: number
  nextRetryAt: number
  lastError: string | null
  createdAt: number
  updatedAt: number
  payload?: SetUpsertPayload
}

type SessionSyncSnapshot = {
  state: SetSyncState
  pending: number
  error: number
}

export type SetQueueSnapshot = {
  state: SetSyncState
  pending: number
  error: number
  isFlushing: boolean
  sessions: Record<string, SessionSyncSnapshot>
  lastError: string | null
}

type SetOperationStore = {
  loadAll: () => Promise<QueuedSetOperation[]>
  put: (operation: QueuedSetOperation) => Promise<void>
  delete: (setId: string) => Promise<void>
}

type SetOperationResult =
  | { success: true }
  | { success: false; retryable: boolean; error: string }

type SetOperationExecutor = (operation: QueuedSetOperation) => Promise<SetOperationResult>

type SetQueueOptions = {
  isOnline?: () => boolean
  now?: () => number
  baseBackoffMs?: number
  maxBackoffMs?: number
}

const DB_NAME = 'ironplan-local-first'
const DB_VERSION = 1
const STORE_NAME = 'set_operations'

const RETRYABLE_ERROR_CODES = new Set([
  '08000',
  '08003',
  '08006',
  '08001',
  '40001',
  '40P01',
  '57014',
  '53300',
  '57P01',
  '57P02',
  '57P03'
])

const NON_RETRYABLE_ERROR_CODES = new Set([
  '22P02',
  '23502',
  '23503',
  '23505',
  '23514',
  '42501',
  'PGRST116',
  'PGRST301'
])

function isIndexedDbAvailable() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function getUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isRetryableSupabaseError(error: { code?: string; status?: number; message?: string }) {
  if (typeof error.status === 'number') {
    if (error.status === 429 || error.status === 408) return true
    if (error.status >= 500) return true
    if (error.status >= 400 && error.status < 500) return false
  }

  if (error.code) {
    if (NON_RETRYABLE_ERROR_CODES.has(error.code)) return false
    if (RETRYABLE_ERROR_CODES.has(error.code)) return true
  }

  const message = (error.message ?? '').toLowerCase()
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return true
  }

  return true
}

class IndexedDbSetOperationStore implements SetOperationStore {
  private dbPromise: Promise<IDBDatabase> | null = null

  private openDb() {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'setId' })
          store.createIndex('sessionId', 'sessionId', { unique: false })
          store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })

    return this.dbPromise
  }

  async loadAll() {
    const db = await this.openDb()
    return new Promise<QueuedSetOperation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve((request.result ?? []) as QueuedSetOperation[])
      request.onerror = () => reject(request.error ?? new Error('Failed to read queue records'))
    })
  }

  async put(operation: QueuedSetOperation) {
    const db = await this.openDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(operation)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to write queue record'))
    })
  }

  async delete(setId: string) {
    const db = await this.openDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(setId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to delete queue record'))
    })
  }
}

export class InMemorySetOperationStore implements SetOperationStore {
  private readonly records = new Map<string, QueuedSetOperation>()

  async loadAll() {
    return Array.from(this.records.values())
  }

  async put(operation: QueuedSetOperation) {
    this.records.set(operation.setId, operation)
  }

  async delete(setId: string) {
    this.records.delete(setId)
  }
}

export class SetOperationQueue {
  private readonly operations = new Map<string, QueuedSetOperation>()
  private readonly listeners = new Set<(snapshot: SetQueueSnapshot) => void>()
  private readonly baseBackoffMs: number
  private readonly maxBackoffMs: number
  private readonly isOnline: () => boolean
  private readonly now: () => number

  private draining = false
  private ready = false
  private drainTimer: ReturnType<typeof setTimeout> | null = null
  private readyPromise: Promise<void>

  constructor(
    private readonly store: SetOperationStore,
    private readonly executor: SetOperationExecutor,
    options: SetQueueOptions = {}
  ) {
    this.baseBackoffMs = options.baseBackoffMs ?? 750
    this.maxBackoffMs = options.maxBackoffMs ?? 60_000
    this.isOnline = options.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine))
    this.now = options.now ?? (() => Date.now())
    this.readyPromise = this.initialize()
  }

  private async initialize() {
    const existing = await this.store.loadAll()
    existing.forEach((operation) => this.operations.set(operation.setId, operation))
    this.ready = true
    this.emit()
    this.scheduleDrain(0)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      document.addEventListener('visibilitychange', this.handleVisibility)
    }
  }

  private readonly handleOnline = () => {
    this.scheduleDrain(0)
  }

  private readonly handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.scheduleDrain(0)
    }
  }

  subscribe(listener: (snapshot: SetQueueSnapshot) => void) {
    this.listeners.add(listener)
    listener(this.buildSnapshot())
    return () => this.listeners.delete(listener)
  }

  getSnapshot() {
    return this.buildSnapshot()
  }

  async enqueueUpsert(input: {
    setId: string
    sessionId: string
    sessionExerciseId: string
    payload: SetUpsertPayload
  }) {
    await this.readyPromise
    const existing = this.operations.get(input.setId)
    const timestamp = this.now()
    const nextRecord: QueuedSetOperation = {
      setId: input.setId,
      sessionId: input.sessionId,
      sessionExerciseId: input.sessionExerciseId,
      kind: 'upsert',
      opId: getUuid(),
      attempts: 0,
      nextRetryAt: timestamp,
      lastError: null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      payload: input.payload
    }
    await this.store.put(nextRecord)
    this.operations.set(input.setId, nextRecord)
    this.emit()
    this.scheduleDrain(0)
  }

  async enqueueDelete(input: {
    setId: string
    sessionId: string
    sessionExerciseId: string
  }) {
    await this.readyPromise
    const existing = this.operations.get(input.setId)
    const timestamp = this.now()
    const nextRecord: QueuedSetOperation = {
      setId: input.setId,
      sessionId: input.sessionId,
      sessionExerciseId: input.sessionExerciseId,
      kind: 'delete',
      opId: getUuid(),
      attempts: 0,
      nextRetryAt: timestamp,
      lastError: null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    }
    await this.store.put(nextRecord)
    this.operations.set(input.setId, nextRecord)
    this.emit()
    this.scheduleDrain(0)
  }

  async cancelSet(setId: string) {
    await this.readyPromise
    await this.store.delete(setId)
    this.operations.delete(setId)
    this.emit()
  }

  async getPendingOperationsForSession(sessionId: string) {
    await this.readyPromise
    return Array.from(this.operations.values())
      .filter((operation) => operation.sessionId === sessionId)
      .sort((left, right) => left.updatedAt - right.updatedAt)
  }

  async flushNow() {
    await this.readyPromise
    await this.drain()
  }

  private scheduleDrain(delayMs: number) {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer)
      this.drainTimer = null
    }
    const safeDelay = Math.max(0, delayMs)
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null
      void this.drain()
    }, safeDelay)
  }

  private getNextRetryAt() {
    let next: number | null = null
    for (const operation of this.operations.values()) {
      if (next === null || operation.nextRetryAt < next) {
        next = operation.nextRetryAt
      }
    }
    return next
  }

  private pickNextDueOperation(now: number) {
    let candidate: QueuedSetOperation | null = null
    for (const operation of this.operations.values()) {
      if (operation.nextRetryAt > now) continue
      if (!candidate) {
        candidate = operation
        continue
      }
      if (operation.updatedAt < candidate.updatedAt) {
        candidate = operation
      }
    }
    return candidate
  }

  private computeBackoffMs(attempt: number) {
    const exponential = this.baseBackoffMs * (2 ** Math.max(0, attempt - 1))
    const capped = Math.min(this.maxBackoffMs, exponential)
    const jitter = Math.floor(Math.random() * 300)
    return capped + jitter
  }

  private async drain() {
    await this.readyPromise
    if (this.draining || !this.ready) return
    if (!this.isOnline()) return

    this.draining = true
    this.emit()

    try {
      while (true) {
        if (!this.isOnline()) break
        const now = this.now()
        const due = this.pickNextDueOperation(now)
        if (!due) {
          const nextRetryAt = this.getNextRetryAt()
          if (nextRetryAt !== null) {
            this.scheduleDrain(nextRetryAt - now)
          }
          break
        }

        const result = await this.executor(due)
        const latestForSet = this.operations.get(due.setId)
        const isStaleResult = !latestForSet || latestForSet.opId !== due.opId

        if (isStaleResult) {
          continue
        }

        if (result.success) {
          await this.store.delete(due.setId)
          this.operations.delete(due.setId)
          this.emit()
          continue
        }

        const attempts = due.attempts + 1
        const retryDelay = result.retryable ? this.computeBackoffMs(attempts) : this.maxBackoffMs
        const failed: QueuedSetOperation = {
          ...due,
          attempts,
          lastError: result.error,
          nextRetryAt: this.now() + retryDelay,
          updatedAt: this.now()
        }
        await this.store.put(failed)
        this.operations.set(failed.setId, failed)
        this.emit()
      }
    } finally {
      this.draining = false
      this.emit()
    }
  }

  private buildSnapshot(): SetQueueSnapshot {
    const sessions: Record<string, SessionSyncSnapshot> = {}
    let pending = 0
    let error = 0
    let lastError: string | null = null

    for (const operation of this.operations.values()) {
      pending += 1
      if (operation.lastError) {
        error += 1
        lastError = operation.lastError
      }

      if (!sessions[operation.sessionId]) {
        sessions[operation.sessionId] = { state: 'synced', pending: 0, error: 0 }
      }

      const session = sessions[operation.sessionId]
      session.pending += 1
      if (operation.lastError) session.error += 1
      session.state = session.error > 0 ? 'error' : 'pending'
    }

    const state: SetSyncState = error > 0 ? 'error' : (pending > 0 || this.draining ? 'pending' : 'synced')

    return {
      state,
      pending,
      error,
      isFlushing: this.draining,
      sessions,
      lastError
    }
  }

  private emit() {
    const snapshot = this.buildSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}

function createSupabaseSetOperationExecutor(supabase: SupabaseClient): SetOperationExecutor {
  return async (operation) => {
    try {
      if (operation.kind === 'delete') {
        const { error } = await supabase.from('sets').delete().eq('id', operation.setId)
        if (error) {
          return {
            success: false,
            retryable: isRetryableSupabaseError(error),
            error: error.message
          }
        }
        return { success: true }
      }

      if (!operation.payload) {
        return { success: false, retryable: false, error: 'Missing set payload.' }
      }

      const row = {
        id: operation.setId,
        ...operation.payload,
        client_set_uuid: operation.setId,
        last_op_id: operation.opId
      }

      const { error } = await supabase
        .from('sets')
        .upsert(row, { onConflict: 'id' })
        .select('id')
        .single()

      if (error) {
        return {
          success: false,
          retryable: isRetryableSupabaseError(error),
          error: error.message
        }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown set sync error'
      return { success: false, retryable: true, error: message }
    }
  }
}

let singletonQueue: SetOperationQueue | null = null

export function getSetOperationQueue(supabase: SupabaseClient) {
  if (singletonQueue) return singletonQueue
  const store = isIndexedDbAvailable() ? new IndexedDbSetOperationStore() : new InMemorySetOperationStore()
  singletonQueue = new SetOperationQueue(store, createSupabaseSetOperationExecutor(supabase))
  return singletonQueue
}

export function __resetSetOperationQueueForTests() {
  singletonQueue = null
}

function mapPayloadToWorkoutSet(payload: SetUpsertPayload, setId: string, existing?: WorkoutSet): WorkoutSet {
  return {
    ...(existing ?? {
      id: setId,
      setNumber: payload.set_number,
      reps: '',
      weight: '',
      implementCount: '',
      loadType: '',
      rpe: '',
      rir: '',
      completed: false
    }),
    id: setId,
    setNumber: payload.set_number,
    reps: payload.reps ?? '',
    weight: payload.weight ?? '',
    implementCount: payload.implement_count ?? '',
    loadType: (payload.load_type as WorkoutSet['loadType']) ?? '',
    rpe: payload.rpe ?? '',
    rir: payload.rir ?? '',
    completed: payload.completed,
    performedAt: payload.performed_at,
    weightUnit: (payload.weight_unit as WorkoutSet['weightUnit']) ?? 'lb',
    durationSeconds: payload.duration_seconds ?? '',
    distance: payload.distance ?? '',
    distanceUnit: payload.distance_unit ?? null,
    restSecondsActual: payload.rest_seconds_actual ?? null,
    extras: (payload.extras as Record<string, string | null>) ?? {},
    extraMetrics: payload.extra_metrics ?? {}
  }
}

export function applyQueuedSetMutations(
  session: WorkoutSession,
  operations: QueuedSetOperation[]
): WorkoutSession {
  if (!operations.length) return session

  const operationMap = new Map<string, QueuedSetOperation[]>()
  for (const operation of operations) {
    if (!operationMap.has(operation.sessionExerciseId)) {
      operationMap.set(operation.sessionExerciseId, [])
    }
    operationMap.get(operation.sessionExerciseId)?.push(operation)
  }

  const exercises = session.exercises.map((exercise) => {
    const exerciseOps = operationMap.get(exercise.id)
    if (!exerciseOps?.length) return exercise

    const setMap = new Map(exercise.sets.map((set) => [set.id, { ...set }]))
    const orderedOps = [...exerciseOps].sort((left, right) => left.updatedAt - right.updatedAt)

    for (const operation of orderedOps) {
      if (operation.kind === 'delete') {
        setMap.delete(operation.setId)
        continue
      }
      if (!operation.payload) continue
      const previous = setMap.get(operation.setId)
      setMap.set(operation.setId, mapPayloadToWorkoutSet(operation.payload, operation.setId, previous))
    }

    const sets = Array.from(setMap.values()).sort((left, right) => left.setNumber - right.setNumber)
    return { ...exercise, sets }
  })

  return { ...session, exercises }
}
