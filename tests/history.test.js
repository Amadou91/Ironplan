import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const historyPath = join(__dirname, '../src/lib/history.ts')
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

const { readHistory, saveHistoryItem } = moduleShim.exports

class MemoryStorage {
  constructor() {
    this.store = new Map()
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }
  setItem(key, value) {
    this.store.set(key, value)
  }
  removeItem(key) {
    this.store.delete(key)
  }
}

test('saveHistoryItem persists and returns most recent entries', () => {
  const storage = new MemoryStorage()
  const item = {
    id: 'fixture-1',
    createdAt: new Date('2024-01-01').toISOString(),
    title: 'Fixture Plan',
    description: 'Fixture description',
    plan: {
      title: 'Fixture Plan',
      description: 'Fixture description',
      goal: 'strength',
      level: 'intermediate',
      tags: [],
      schedule: [],
      inputs: {
        goals: { primary: 'strength', priority: 'primary' },
        experienceLevel: 'intermediate',
        intensity: 'moderate',
        equipment: {
          bodyweight: true,
          dumbbells: [],
          kettlebells: [],
          bands: [],
          barbell: { available: false, barWeight: 45, plates: [] },
          machines: {
            bench: false,
            lat_pulldown: false,
            cable: false,
            assault_bike: false,
            leg_press: false
          }
        },
        time: { minutesPerSession: 30 },
        schedule: { daysAvailable: [1], timeWindows: ['morning'], minRestDays: 1 },
        preferences: { focusAreas: [], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
      },
      summary: {
        sessionsPerWeek: 1,
        totalMinutes: 30,
        focusDistribution: { upper: 0, lower: 0, full_body: 0, core: 0, cardio: 0, mobility: 1 },
        workoutScore: { total: 10, breakdown: { volume: 4, intensity: 3, density: 3 } }
      }
    }
  }

  const firstSave = saveHistoryItem(storage, item, 5)
  assert.equal(firstSave.length, 1)
  assert.equal(readHistory(storage).length, 1)

  const secondSave = saveHistoryItem(storage, { ...item, id: 'fixture-2' }, 5)
  assert.equal(secondSave.length, 2)
  assert.equal(readHistory(storage)[0].id, 'fixture-2')
})
