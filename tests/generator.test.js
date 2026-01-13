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

const { generatePlan, calculateWorkoutScore } = moduleShim.exports

const baseEquipment = {
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
}

test('validate input errors when required fields are missing', () => {
  const { errors } = generatePlan({
    schedule: { daysAvailable: [], timeWindows: [], minRestDays: 1 },
    equipment: { ...baseEquipment, bodyweight: false }
  })

  assert.ok(errors.length >= 2)
})

test('respects time and schedule constraints when generating sessions', () => {
  const { plan, errors } = generatePlan({
    goals: { primary: 'endurance', priority: 'primary' },
    time: { minutesPerSession: 40, totalMinutesPerWeek: 120 },
    schedule: { daysAvailable: [1, 2, 4, 6], timeWindows: ['morning'], minRestDays: 1 },
    equipment: baseEquipment,
    preferences: { focusAreas: ['cardio'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  assert.equal(errors.length, 0)
  assert.ok(plan)
  assert.equal(plan.schedule.length, 3)
  assert.ok(plan.schedule.every(day => day.durationMinutes <= 120))
  assert.ok(plan.summary.totalMinutes <= 120)
})

test('respects equipment constraints for bodyweight-only plans', () => {
  const { plan, errors } = generatePlan({
    goals: { primary: 'general_fitness', priority: 'primary' },
    time: { minutesPerSession: 30 },
    schedule: { daysAvailable: [2, 4], timeWindows: ['morning'], minRestDays: 1 },
    equipment: baseEquipment,
    preferences: { focusAreas: [], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  assert.equal(errors.length, 0)
  assert.ok(plan)
  const allExercises = plan.schedule.flatMap(day => day.exercises)
  assert.ok(allExercises.length > 0)
  assert.ok(allExercises.every(exercise => exercise.equipment.includes('bodyweight')))
})

test('respects equipment constraints for dumbbell-only plans', () => {
  const { plan, errors } = generatePlan({
    goals: { primary: 'hypertrophy', priority: 'primary' },
    time: { minutesPerSession: 45 },
    schedule: { daysAvailable: [1, 3, 5], timeWindows: ['evening'], minRestDays: 1 },
    equipment: { ...baseEquipment, bodyweight: false, dumbbells: [20, 30] },
    preferences: { focusAreas: [], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  assert.equal(errors.length, 0)
  assert.ok(plan)
  const allExercises = plan.schedule.flatMap(day => day.exercises)
  assert.ok(allExercises.length > 0)
  assert.ok(allExercises.every(exercise => exercise.equipment.includes('dumbbells')))
})

test('calculates stable workout score for a known fixture', () => {
  const score = calculateWorkoutScore([
    {
      dayOfWeek: 1,
      timeWindow: 'morning',
      focus: 'upper',
      durationMinutes: 40,
      rationale: 'Fixture',
      exercises: [
        { name: 'Fixture Press', focus: 'upper', sets: 3, reps: '8-10', rpe: 8, equipment: ['dumbbells'], durationMinutes: 10 },
        { name: 'Fixture Row', focus: 'upper', sets: 3, reps: '10', rpe: 7, equipment: ['dumbbells'], durationMinutes: 10 }
      ]
    }
  ])

  assert.deepEqual(score, {
    total: 16,
    breakdown: {
      volume: 6,
      intensity: 8,
      density: 2
    }
  })
})
