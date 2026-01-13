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

const equipmentPath = join(__dirname, '../src/lib/equipment.ts')
const equipmentSource = readFileSync(equipmentPath, 'utf8')
const { outputText: equipmentOutput } = ts.transpileModule(equipmentSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
})

const moduleShim = { exports: {} }
const equipmentModuleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)
const equipmentFactory = new Function('module', 'exports', 'require', equipmentOutput)
equipmentFactory(equipmentModuleShim, equipmentModuleShim.exports, requireShim)

const requireWithEquipment = (moduleId) => {
  if (moduleId === './equipment' || moduleId === '../src/lib/equipment') {
    return equipmentModuleShim.exports
  }
  return requireShim(moduleId)
}

const factory = new Function('module', 'exports', 'require', outputText)
factory(moduleShim, moduleShim.exports, requireWithEquipment)

const { calculateWorkoutImpact, generatePlan } = moduleShim.exports

test('validate input errors when required fields are missing', () => {
  const { errors } = generatePlan({
    schedule: { daysAvailable: [], timeWindows: [], minRestDays: 1 },
    equipment: { preset: 'custom', inventory: { bodyweight: false, dumbbells: [], kettlebells: [], bands: [], barbell: { available: false, plates: [] }, machines: { cable: false, leg_press: false, treadmill: false, rower: false } } }
  })

  assert.ok(errors.length >= 2)
})

test('respects time and schedule constraints when generating sessions', () => {
  const { plan, errors } = generatePlan({
    goals: { primary: 'endurance', priority: 'primary' },
    time: { minutesPerSession: 40, totalMinutesPerWeek: 120 },
    schedule: { daysAvailable: [1, 2, 4, 6], timeWindows: ['morning'], minRestDays: 1 },
    equipment: {
      preset: 'custom',
      inventory: {
        bodyweight: true,
        dumbbells: [],
        kettlebells: [],
        bands: [],
        barbell: { available: false, plates: [] },
        machines: { cable: false, leg_press: false, treadmill: false, rower: false }
      }
    },
    preferences: { focusAreas: ['cardio'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  assert.equal(errors.length, 0)
  assert.ok(plan)
  assert.equal(plan.schedule.length, 3)
  assert.ok(plan.schedule.every(day => day.durationMinutes <= 120))
  assert.ok(plan.summary.totalMinutes <= 120)
})

test('filters exercises to available equipment inventory', () => {
  const { plan, errors } = generatePlan({
    equipment: {
      preset: 'custom',
      inventory: {
        bodyweight: true,
        dumbbells: [],
        kettlebells: [],
        bands: [],
        barbell: { available: false, plates: [] },
        machines: { cable: false, leg_press: false, treadmill: false, rower: false }
      }
    },
    preferences: { focusAreas: ['core'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  assert.equal(errors.length, 0)
  assert.ok(plan)

  const allExercises = plan.schedule.flatMap(day => day.exercises)
  assert.ok(allExercises.length > 0)
  assert.ok(allExercises.every(exercise => exercise.equipment.some(option => option.kind === 'bodyweight')))
})

test('calculates a stable impact score for a known fixture', () => {
  const impact = calculateWorkoutImpact([
    {
      dayOfWeek: 1,
      timeWindow: 'morning',
      focus: 'upper',
      durationMinutes: 30,
      rationale: 'Test day',
      exercises: [
        {
          name: 'Test Press',
          focus: 'upper',
          sets: 3,
          reps: '10',
          rpe: 7,
          equipment: [{ kind: 'dumbbell' }],
          durationMinutes: 10,
          load: { value: 40, unit: 'lb', label: '2x20 lb dumbbells' }
        }
      ]
    }
  ])

  assert.equal(impact.breakdown.volume, 12)
  assert.equal(impact.breakdown.intensity, 4)
  assert.equal(impact.breakdown.density, 2)
  assert.equal(impact.score, 18)
})
