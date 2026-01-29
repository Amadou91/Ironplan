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

// Module Loading System (robust loader that handles transitive @/ imports)
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
      
      return loadTsModule(resolved) // Fallback attempt
    }

    // Handle Relative Imports
    if (moduleId.startsWith('.')) {
      const resolvedCandidate = join(moduleDir, moduleId)
      const resolvedTs = resolvedCandidate + '.ts'
      if (existsSync(resolvedTs)) {
        return loadTsModule(resolvedTs)
      }
      const resolvedIndex = join(resolvedCandidate, 'index.ts')
      if (existsSync(resolvedIndex)) {
        return loadTsModule(resolvedIndex)
      }
    }

    // Fallback to Node Require
    return requireShim(moduleId)
  }

  const factory = new Function('module', 'exports', 'require', moduleOutput)
  factory(moduleShim, moduleShim.exports, contextRequire)
  moduleCache.set(modulePath, moduleShim.exports)
  return moduleShim.exports
}

const historyPath = join(__dirname, '../src/lib/workoutHistory.ts')
const moduleExports = loadTsModule(historyPath)
const { loadWorkoutHistory, saveWorkoutHistoryEntry } = moduleExports

class MemoryStorage {
  #store = new Map()
  getItem(key) {
    return this.#store.get(key) ?? null
  }
  setItem(key, value) {
    this.#store.set(key, value)
  }
  removeItem(key) {
    this.#store.delete(key)
  }
}

test('workout history persists and reloads entries', () => {
  const storage = new MemoryStorage()
  const entry = {
    id: 'entry-1',
    title: 'Test Template',
    createdAt: '2024-01-01T00:00:00.000Z',
    template: {
      title: 'Test Template',
      description: 'Test Description',
      focus: 'chest',
      style: 'strength',
      inputs: {
        intent: { mode: 'body_part', bodyParts: ['chest'], style: 'strength' },
        goals: { primary: 'strength', priority: 'primary' },
        experienceLevel: 'beginner',
        intensity: 'low',
        equipment: {
          preset: 'full_gym',
          inventory: {
            bodyweight: true,
            benchPress: false,
            dumbbells: [],
            kettlebells: [],
            bands: [],
            barbell: { available: false, plates: [] },
            machines: { cable: false, leg_press: false, treadmill: false, rower: false }
          }
        },
        time: { minutesPerSession: 30 },
        schedule: { daysAvailable: [0], minRestDays: 1 },
        preferences: { focusAreas: ['chest'], dislikedActivities: [], cardioActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
      }
    }
  }

  saveWorkoutHistoryEntry(entry, storage)
  const loaded = loadWorkoutHistory(storage)

  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].title, 'Test Template')
  assert.equal(loaded[0].template.style, 'strength')
})
