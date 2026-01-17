import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const historyPath = join(__dirname, '../src/lib/workoutHistory.ts')
const source = readFileSync(historyPath, 'utf8')

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
})

const moduleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)
const factory = new Function('module', 'exports', 'require', outputText)
factory(moduleShim, moduleShim.exports, requireShim)

const { loadWorkoutHistory, saveWorkoutHistoryEntry } = moduleShim.exports

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
        equipment: { preset: 'full_gym', inventory: { bodyweight: true, dumbbells: [], kettlebells: [], bands: [], barbell: { available: false, plates: [] }, machines: { cable: false, leg_press: false, treadmill: false, rower: false } } },
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
