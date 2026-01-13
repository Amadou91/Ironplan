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
    title: 'Test Plan',
    createdAt: '2024-01-01T00:00:00.000Z',
    plan: {
      title: 'Test Plan',
      description: 'Test Description',
      goal: 'strength',
      level: 'beginner',
      tags: ['strength'],
      schedule: [],
      inputs: {},
      summary: { sessionsPerWeek: 1, totalMinutes: 30, focusDistribution: { upper: 0, lower: 0, full_body: 0, core: 0, cardio: 0, mobility: 0 }, impact: { score: 10, breakdown: { volume: 4, intensity: 4, density: 2 } } }
    }
  }

  saveWorkoutHistoryEntry(entry, storage)
  const loaded = loadWorkoutHistory(storage)

  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].title, 'Test Plan')
  assert.equal(loaded[0].plan.summary.impact.score, 10)
})
