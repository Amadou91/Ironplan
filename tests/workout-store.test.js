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

// --- 1. Polyfills for Node Environment ---
// The store uses 'localStorage' and 'crypto.randomUUID', which might not be present in the test env context.
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()

if (!global.localStorage) {
  global.localStorage = localStorageMock
}

if (!global.crypto) {
  global.crypto = { randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9) }
}


// --- 2. Module Loading System (Copied from tests/generator.test.js) ---
const moduleCache = new Map()

function loadTsModule(modulePath) {
  if (moduleCache.has(modulePath)) return moduleCache.get(modulePath)

  const moduleSource = readFileSync(modulePath, 'utf8')
  const { outputText: moduleOutput } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  })

  const moduleShim = { exports: {} }
  const moduleDir = dirname(modulePath)

  const contextRequire = (moduleId) => {
    // Handle Aliases (@/)
    if (moduleId.startsWith('@/')) {
      const relativePath = moduleId.replace('@/', '')
      const resolved = join(__dirname, '../src', `${relativePath}.ts`)
      if (existsSync(resolved)) return loadTsModule(resolved)
      
      const resolvedIndex = join(__dirname, '../src', relativePath, 'index.ts')
      if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex)
      
      return loadTsModule(resolved)
    }

    // Handle Relative Imports
    if (moduleId.startsWith('.')) {
      const resolvedCandidate = join(moduleDir, moduleId)
      const resolvedTs = resolvedCandidate + '.ts'
      if (existsSync(resolvedTs)) return loadTsModule(resolvedTs)
       const resolvedIndex = join(resolvedCandidate, 'index.ts')
       if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex)
       
       try { return requireShim(moduleId) } catch { throw new Error(`Cannot resolve module '${moduleId}' from '${modulePath}'`) }
    }

    return requireShim(moduleId)
  }

  const factory = new Function('module', 'exports', 'require', moduleOutput)
  factory(moduleShim, moduleShim.exports, contextRequire)
  moduleCache.set(modulePath, moduleShim.exports)
  return moduleShim.exports
}

// --- 3. Load the Store ---
const storePath = join(__dirname, '../src/store/useWorkoutStore.ts')
// We need to verify if the store exports 'useWorkoutStore' correctly after transpilation.
// In the source it is: export const useWorkoutStore = create(...)
const { useWorkoutStore } = loadTsModule(storePath)

// --- 4. Tests ---

test('Store: starts with no active session', () => {
  const state = useWorkoutStore.getState()
  assert.equal(state.activeSession, null)
})

test('Store: can start a session', () => {
  const sessionData = {
    id: 'sess-123',
    name: 'Test Session',
    exercises: []
  }
  
  useWorkoutStore.getState().startSession(sessionData)
  
  const state = useWorkoutStore.getState()
  assert.equal(state.activeSession.id, 'sess-123')
  assert.equal(state.activeSession.name, 'Test Session')
})

test('Store: addSessionExercise adds an exercise correctly', () => {
  const exercise = {
    id: 'ex-1',
    name: 'Bench Press',
    sets: [],
    orderIndex: 0
  }
  
  useWorkoutStore.getState().addSessionExercise(exercise)
  
  const state = useWorkoutStore.getState()
  assert.equal(state.activeSession.exercises.length, 1)
  assert.equal(state.activeSession.exercises[0].name, 'Bench Press')
})

test('Store: addSet creates a set with default empty strings (Risk Check)', () => {
  // Setup: Ensure we have an exercise at index 0
  if (useWorkoutStore.getState().activeSession.exercises.length === 0) {
     useWorkoutStore.getState().addSessionExercise({ id: 'ex-1', name: 'Bench', sets: [], orderIndex: 0 })
  }

  const newSet = useWorkoutStore.getState().addSet(0, 'lb', null)
  
  assert.ok(newSet)
  assert.equal(newSet.reps, '') // This confirms the 'Empty String' behavior
  assert.equal(newSet.weight, '') 
  assert.equal(newSet.completed, false)
  
  // Verify it's in the state
  const state = useWorkoutStore.getState()
  assert.equal(state.activeSession.exercises[0].sets.length, 1)
})

test('Store: updateSet modifies the correct set', () => {
  // Setup: Ensure we have a set
  const stateBefore = useWorkoutStore.getState()
  if (stateBefore.activeSession.exercises[0].sets.length === 0) {
    useWorkoutStore.getState().addSet(0, 'lb', null)
  }

  useWorkoutStore.getState().updateSet(0, 0, 'reps', 10)
  useWorkoutStore.getState().updateSet(0, 0, 'weight', 135)
  
  const stateAfter = useWorkoutStore.getState()
  const set = stateAfter.activeSession.exercises[0].sets[0]
  
  assert.equal(set.reps, 10)
  assert.equal(set.weight, 135)
})

test('Store: persistence writes to localStorage', () => {
  // Check the mock
  const storedData = global.localStorage.getItem('ironplan-active-session')
  assert.ok(storedData)
  
  const parsed = JSON.parse(storedData)
  assert.ok(parsed.state.activeSession)
  assert.equal(parsed.state.activeSession.id, 'sess-123')
})

test('Store: endSession clears state', () => {
  useWorkoutStore.getState().endSession()
  
  const state = useWorkoutStore.getState()
  assert.equal(state.activeSession, null)
})
