import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const generatorPath = join(__dirname, '../src/lib/generator.ts')
const source = readFileSync(generatorPath, 'utf8')

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

const { generatePlan } = moduleShim.exports

test('validate input errors when required fields are missing', () => {
  const { errors } = generatePlan({
    schedule: { daysAvailable: [], timeWindows: [], minRestDays: 1 },
    equipment: []
  })

  assert.ok(errors.length >= 2)
})

test('respects time and schedule constraints when generating sessions', () => {
  const { plan, errors } = generatePlan({
    goals: { primary: 'endurance', priority: 'primary' },
    time: { minutesPerSession: 40, totalMinutesPerWeek: 120 },
    schedule: { daysAvailable: [1, 2, 4, 6], timeWindows: ['morning'], minRestDays: 1 },
    equipment: ['bodyweight'],
    preferences: { focusAreas: ['cardio'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  assert.equal(errors.length, 0)
  assert.ok(plan)
  assert.equal(plan.schedule.length, 3)
  assert.ok(plan.schedule.every(day => day.durationMinutes <= 120))
  assert.ok(plan.summary.totalMinutes <= 120)
})
