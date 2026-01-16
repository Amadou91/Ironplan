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

const moduleCache = new Map()

function requireWithEquipment(moduleId) {
  if (moduleId === './equipment' || moduleId === '../src/lib/equipment') {
    return equipmentModuleShim.exports
  }
  if (moduleId.startsWith('@/')) {
    const resolved = join(__dirname, '../src', `${moduleId.replace('@/', '')}.ts`)
    return loadTsModule(resolved)
  }
  return requireShim(moduleId)
}

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
  const factory = new Function('module', 'exports', 'require', moduleOutput)
  factory(moduleShim, moduleShim.exports, requireWithEquipment)
  moduleCache.set(modulePath, moduleShim.exports)
  return moduleShim.exports
}

const factory = new Function('module', 'exports', 'require', outputText)
factory(moduleShim, moduleShim.exports, requireWithEquipment)

const { calculateWorkoutImpact, generatePlan } = moduleShim.exports

const getPrimaryMuscle = (exercise) =>
  (exercise.primaryBodyParts && exercise.primaryBodyParts[0]) || exercise.primaryMuscle || ''

test('validate input errors when required fields are missing', () => {
  const { errors } = generatePlan({
    intent: { mode: 'body_part', bodyParts: [] },
    schedule: { daysAvailable: [], timeWindows: [], minRestDays: 1 },
    equipment: { preset: 'custom', inventory: { bodyweight: false, dumbbells: [], kettlebells: [], bands: [], barbell: { available: false, plates: [] }, machines: { cable: false, leg_press: false, treadmill: false, rower: false } } }
  })

  assert.ok(errors.length >= 2)
})

test('chest focus stays chest-dominant with allowed accessories', () => {
  const { plan, errors } = generatePlan({
    intent: { mode: 'body_part', bodyParts: ['chest'] },
    preferences: { focusAreas: ['chest'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  assert.equal(errors.length, 0)
  assert.ok(plan)

  const exercises = plan.schedule.flatMap(day => day.exercises)
  assert.ok(exercises.length > 0)

  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0)
  const chestSets = exercises.reduce((sum, ex) => {
    const primary = String(getPrimaryMuscle(ex)).toLowerCase()
    return primary.includes('chest') ? sum + (ex.sets || 0) : sum
  }, 0)
  const forbidden = exercises.filter(ex => {
    const primary = String(getPrimaryMuscle(ex)).toLowerCase()
    return primary.includes('back') || primary.includes('biceps')
  })

  assert.ok(forbidden.length === 0)
  assert.ok(totalSets > 0)
  assert.ok(chestSets / totalSets >= 0.75)
})

test('returns an error when chest focus cannot be satisfied by equipment', () => {
  const { plan, errors } = generatePlan({
    intent: { mode: 'body_part', bodyParts: ['chest'] },
    preferences: { focusAreas: ['chest'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' },
    equipment: {
      preset: 'custom',
      inventory: {
        bodyweight: false,
        dumbbells: [],
        kettlebells: [],
        bands: [],
        barbell: { available: false, plates: [] },
        machines: { cable: false, leg_press: false, treadmill: false, rower: true }
      }
    }
  })

  assert.ok(errors.length > 0)
  assert.equal(plan, undefined)
})

test('back focus avoids unrelated primary muscles', () => {
  const { plan, errors } = generatePlan({
    intent: { mode: 'body_part', bodyParts: ['back'] },
    preferences: { focusAreas: ['back'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  assert.equal(errors.length, 0)
  assert.ok(plan)

  const exercises = plan.schedule.flatMap(day => day.exercises)
  assert.ok(exercises.length > 0)

  const forbidden = exercises.filter(ex => {
    const primary = String(getPrimaryMuscle(ex)).toLowerCase()
    return primary.includes('chest') || primary.includes('quads') || primary.includes('hamstrings')
  })

  assert.ok(forbidden.length === 0)
})

test('respects time and schedule constraints when generating sessions', () => {
  const { plan, errors } = generatePlan({
    intent: { mode: 'body_part', bodyParts: ['cardio'] },
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
  assert.equal(plan.schedule.length, 1)
  assert.ok(plan.schedule.every(day => day.durationMinutes <= 120))
  assert.ok(plan.summary.totalMinutes <= 120)
})

test('filters exercises to available equipment inventory', () => {
  const { plan, errors } = generatePlan({
    intent: { mode: 'body_part', bodyParts: ['core'] },
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

  assert.equal(impact.breakdown.volume, 30)
  assert.equal(impact.breakdown.intensity, 7)
  assert.equal(impact.breakdown.density, 3)
  assert.equal(impact.score, 40)
})
