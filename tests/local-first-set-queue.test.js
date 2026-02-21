import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const requireShim = createRequire(import.meta.url)
const moduleCache = new Map()

function loadTsModule(modulePath) {
  if (moduleCache.has(modulePath)) return moduleCache.get(modulePath)

  const moduleSource = readFileSync(modulePath, 'utf8')
  const { outputText } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  })

  const moduleShim = { exports: {} }
  const moduleDir = dirname(modulePath)

  const contextRequire = (moduleId) => {
    if (moduleId.startsWith('@/')) {
      const relativePath = moduleId.replace('@/', '')
      const resolved = join(__dirname, '../src', `${relativePath}.ts`)
      if (existsSync(resolved)) return loadTsModule(resolved)

      const resolvedTsx = join(__dirname, '../src', `${relativePath}.tsx`)
      if (existsSync(resolvedTsx)) return loadTsModule(resolvedTsx)

      const resolvedIndex = join(__dirname, '../src', relativePath, 'index.ts')
      if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex)

      return loadTsModule(resolved)
    }

    if (moduleId.startsWith('.')) {
      const resolvedCandidate = join(moduleDir, moduleId)
      const resolvedTs = `${resolvedCandidate}.ts`
      if (existsSync(resolvedTs)) return loadTsModule(resolvedTs)

      const resolvedTsx = `${resolvedCandidate}.tsx`
      if (existsSync(resolvedTsx)) return loadTsModule(resolvedTsx)
    }

    return requireShim(moduleId)
  }

  const factory = new Function('module', 'exports', 'require', outputText)
  factory(moduleShim, moduleShim.exports, contextRequire)
  moduleCache.set(modulePath, moduleShim.exports)
  return moduleShim.exports
}

const queueModule = loadTsModule(join(__dirname, '../src/lib/local-first/set-operation-queue.ts'))
const {
  SetOperationQueue,
  InMemorySetOperationStore,
  applyQueuedSetMutations
} = queueModule

async function waitFor(condition, timeoutMs = 1_000) {
  const startedAt = Date.now()
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

const basePayload = {
  session_exercise_id: 'exercise-1',
  set_number: 1,
  reps: 8,
  weight: 185,
  implement_count: null,
  load_type: 'total',
  rpe: 8,
  rir: 2,
  completed: true,
  performed_at: '2026-02-20T10:00:00.000Z',
  weight_unit: 'lb',
  duration_seconds: null,
  distance: null,
  distance_unit: null,
  rest_seconds_actual: 120,
  extras: {},
  extra_metrics: {}
}

test('SetOperationQueue coalesces duplicate set writes and retries with backoff', async () => {
  const store = new InMemorySetOperationStore()
  let online = false
  let now = 0
  const calls = []
  let failFirst = true

  const queue = new SetOperationQueue(
    store,
    async (op) => {
      calls.push(op)
      if (failFirst) {
        failFirst = false
        return { success: false, retryable: true, error: 'temporary network issue' }
      }
      return { success: true }
    },
    { isOnline: () => online, now: () => now, baseBackoffMs: 10, maxBackoffMs: 50 }
  )

  await queue.enqueueUpsert({
    setId: 'set-1',
    sessionId: 'session-1',
    sessionExerciseId: 'exercise-1',
    payload: basePayload
  })

  await queue.enqueueUpsert({
    setId: 'set-1',
    sessionId: 'session-1',
    sessionExerciseId: 'exercise-1',
    payload: { ...basePayload, reps: 10 }
  })

  const queued = await store.loadAll()
  assert.equal(queued.length, 1)
  assert.equal(queued[0].payload.reps, 10)

  online = true
  await queue.flushNow()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].payload.reps, 10)

  now = 5_000
  await queue.flushNow()
  assert.equal(calls.length, 2)
  assert.equal((await store.loadAll()).length, 0)
  assert.equal(queue.getSnapshot().state, 'synced')
})

test('SetOperationQueue cancelSet prevents ghost inserts after local delete', async () => {
  const store = new InMemorySetOperationStore()
  const calls = []
  const queue = new SetOperationQueue(
    store,
    async (op) => {
      calls.push(op)
      return { success: true }
    },
    { isOnline: () => true }
  )

  await queue.enqueueUpsert({
    setId: 'set-ghost',
    sessionId: 'session-1',
    sessionExerciseId: 'exercise-1',
    payload: basePayload
  })
  await queue.cancelSet('set-ghost')
  await queue.flushNow()

  assert.equal(calls.length, 0)
  assert.equal((await store.loadAll()).length, 0)
})

test('SetOperationQueue resumes persisted operations after queue re-instantiation', async () => {
  const store = new InMemorySetOperationStore()
  const queue1 = new SetOperationQueue(store, async () => ({ success: true }), { isOnline: () => false })

  await queue1.enqueueUpsert({
    setId: 'set-resume',
    sessionId: 'session-2',
    sessionExerciseId: 'exercise-2',
    payload: basePayload
  })

  const replayed = []
  const queue2 = new SetOperationQueue(
    store,
    async (op) => {
      replayed.push(op)
      return { success: true }
    },
    { isOnline: () => true }
  )

  await queue2.flushNow()
  assert.equal(replayed.length, 1)
  assert.equal(replayed[0].setId, 'set-resume')
  assert.equal((await store.loadAll()).length, 0)
})

test('SetOperationQueue keeps latest write when an older in-flight op resolves later', async () => {
  const store = new InMemorySetOperationStore()
  const calls = []
  let releaseFirstCall = null

  const queue = new SetOperationQueue(
    store,
    async (op) => {
      calls.push(op)
      if (calls.length === 1) {
        await new Promise((resolve) => { releaseFirstCall = resolve })
      }
      return { success: true }
    },
    { isOnline: () => true }
  )

  await queue.enqueueUpsert({
    setId: 'set-race',
    sessionId: 'session-race',
    sessionExerciseId: 'exercise-race',
    payload: { ...basePayload, session_exercise_id: 'exercise-race', reps: 8 }
  })

  const firstFlush = queue.flushNow()
  await waitFor(() => calls.length === 1)

  await queue.enqueueUpsert({
    setId: 'set-race',
    sessionId: 'session-race',
    sessionExerciseId: 'exercise-race',
    payload: { ...basePayload, session_exercise_id: 'exercise-race', reps: 12 }
  })

  const queuedBeforeRelease = await store.loadAll()
  assert.equal(queuedBeforeRelease.length, 1)
  assert.equal(queuedBeforeRelease[0].payload.reps, 12)
  assert.notEqual(queuedBeforeRelease[0].opId, calls[0].opId)
  assert.ok(releaseFirstCall)

  releaseFirstCall()
  await firstFlush

  assert.equal(calls.length, 2)
  assert.equal(calls[0].payload.reps, 8)
  assert.equal(calls[1].payload.reps, 12)
  assert.equal((await store.loadAll()).length, 0)
})

test('Queued local set is replayed on refresh before first successful sync', async () => {
  const store = new InMemorySetOperationStore()
  const queueBeforeRefresh = new SetOperationQueue(
    store,
    async () => ({ success: true }),
    { isOnline: () => false }
  )

  await queueBeforeRefresh.enqueueUpsert({
    setId: 'set-offline',
    sessionId: 'session-refresh',
    sessionExerciseId: 'exercise-refresh',
    payload: { ...basePayload, session_exercise_id: 'exercise-refresh', set_number: 1, reps: 6, weight: 95 }
  })

  const queueAfterRefresh = new SetOperationQueue(
    store,
    async () => ({ success: true }),
    { isOnline: () => false }
  )

  const pending = await queueAfterRefresh.getPendingOperationsForSession('session-refresh')
  const remoteSession = {
    id: 'session-refresh',
    userId: 'user-1',
    name: 'Push Day',
    startedAt: '2026-02-20T09:00:00.000Z',
    exercises: [
      {
        id: 'exercise-refresh',
        sessionId: 'session-refresh',
        name: 'Press',
        primaryMuscle: 'Chest',
        secondaryMuscles: [],
        sets: [],
        orderIndex: 0
      }
    ]
  }

  const hydrated = applyQueuedSetMutations(remoteSession, pending)
  assert.equal(hydrated.exercises[0].sets.length, 1)
  assert.equal(hydrated.exercises[0].sets[0].id, 'set-offline')
  assert.equal(hydrated.exercises[0].sets[0].reps, 6)
  assert.equal(hydrated.exercises[0].sets[0].weight, 95)
})

test('SetOperationQueue does not endlessly retry non-retryable failures', async () => {
  const store = new InMemorySetOperationStore()
  const calls = []

  const queue = new SetOperationQueue(
    store,
    async (op) => {
      calls.push(op)
      return { success: false, retryable: false, error: 'constraint violation' }
    },
    { isOnline: () => true, now: () => 0, baseBackoffMs: 10, maxBackoffMs: 50 }
  )

  await queue.enqueueUpsert({
    setId: 'set-invalid',
    sessionId: 'session-invalid',
    sessionExerciseId: 'exercise-invalid',
    payload: { ...basePayload, session_exercise_id: 'exercise-invalid', reps: -1 }
  })

  await queue.flushNow()
  await queue.flushNow()

  assert.equal(calls.length, 1)
  const queued = await store.loadAll()
  assert.equal(queued.length, 1)
  assert.equal(queued[0].lastError, 'constraint violation')
  assert.equal(queued[0].nextRetryAt, Number.POSITIVE_INFINITY)
  assert.equal(queue.getSnapshot().state, 'error')
})

test('applyQueuedSetMutations replays pending set updates/additions over hydrated session data', () => {
  const session = {
    id: 'session-1',
    userId: 'user-1',
    name: 'Pull Day',
    startedAt: '2026-02-20T09:00:00.000Z',
    exercises: [
      {
        id: 'exercise-1',
        sessionId: 'session-1',
        name: 'Row',
        primaryMuscle: 'Back',
        secondaryMuscles: [],
        sets: [
          {
            id: 'set-1',
            setNumber: 1,
            reps: 8,
            weight: 135,
            completed: true
          }
        ],
        orderIndex: 0
      }
    ]
  }

  const operations = [
    {
      setId: 'set-1',
      sessionId: 'session-1',
      sessionExerciseId: 'exercise-1',
      kind: 'upsert',
      opId: 'op-1',
      attempts: 0,
      nextRetryAt: 0,
      lastError: null,
      createdAt: 1,
      updatedAt: 1,
      payload: { ...basePayload, session_exercise_id: 'exercise-1', set_number: 1, reps: 10, weight: 145 }
    },
    {
      setId: 'set-2',
      sessionId: 'session-1',
      sessionExerciseId: 'exercise-1',
      kind: 'upsert',
      opId: 'op-2',
      attempts: 0,
      nextRetryAt: 0,
      lastError: null,
      createdAt: 2,
      updatedAt: 2,
      payload: { ...basePayload, session_exercise_id: 'exercise-1', set_number: 2, reps: 8, weight: 155 }
    }
  ]

  const merged = applyQueuedSetMutations(session, operations)
  assert.equal(merged.exercises[0].sets.length, 2)
  assert.equal(merged.exercises[0].sets[0].id, 'set-1')
  assert.equal(merged.exercises[0].sets[0].reps, 10)
  assert.equal(merged.exercises[0].sets[1].id, 'set-2')
  assert.equal(merged.exercises[0].sets[1].weight, 155)
})
