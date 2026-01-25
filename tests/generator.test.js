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

// Module Loading System
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
      
      // Try resolving as folder with implicit index (if index.ts logic fails)
      // or maybe it's a file without extension in import? (rare in this project)
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
       // Try generic node resolution for non-ts files?
       try {
         return requireShim(moduleId)
       } catch (e) {
         // If requireShim fails, throw original error or similar
         throw new Error(`Cannot resolve module '${moduleId}' from '${modulePath}'`)
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

// Load Generator (Entry Point)
const generatorPath = join(__dirname, '../src/lib/generator/index.ts')
const generatorModule = loadTsModule(generatorPath)

const { calculateWorkoutImpact, buildWorkoutTemplate, generateSessionExercises, normalizePlanInput } = generatorModule

const getPrimaryMuscle = (exercise) =>
  (exercise.primaryBodyParts && exercise.primaryBodyParts[0]) || exercise.primaryMuscle || ''

// Tests
test('validate input errors when required fields are missing', () => {
  const { errors } = buildWorkoutTemplate({
    intent: { mode: 'body_part', bodyParts: [] },
    schedule: { daysAvailable: [], minRestDays: 1 },
    equipment: { preset: 'custom', inventory: { bodyweight: false, dumbbells: [], kettlebells: [], bands: [], barbell: { available: false, plates: [] }, machines: { cable: false, leg_press: false, treadmill: false, rower: false } } }
  })

  assert.ok(errors.length >= 2)
})

test('chest focus stays chest-dominant with allowed accessories', () => {
  const input = normalizePlanInput({
    intent: { mode: 'body_part', bodyParts: ['chest'] },
    preferences: { focusAreas: ['chest'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  const exercises = generateSessionExercises(input, 'chest', 45, input.goals.primary, { seed: 'seed-chest' })
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
  const input = normalizePlanInput({
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
        machines: { cable: false, leg_press: false, treadmill: false, rower: false }
      }
    }
  })
  const exercises = generateSessionExercises(input, 'chest', 45, input.goals.primary, { seed: 'seed-empty' })
  assert.equal(exercises.length, 0)
})

test('back focus avoids unrelated primary muscles', () => {
  const input = normalizePlanInput({
    intent: { mode: 'body_part', bodyParts: ['back'] },
    preferences: { focusAreas: ['back'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  const exercises = generateSessionExercises(input, 'back', 45, input.goals.primary, { seed: 'seed-back' })
  assert.ok(exercises.length > 0)

  const forbidden = exercises.filter(ex => {
    const primary = String(getPrimaryMuscle(ex)).toLowerCase()
    return primary.includes('chest') || primary.includes('quads') || primary.includes('hamstrings')
  })

  assert.ok(forbidden.length === 0)
})

test('time availability scales exercise count and volume', () => {
  const input = normalizePlanInput({
    intent: { mode: 'body_part', bodyParts: ['upper'] },
    goals: { primary: 'endurance', priority: 'primary' },
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
    preferences: { focusAreas: ['upper'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  const shortSession = generateSessionExercises(input, 'upper', 30, input.goals.primary, { seed: 'seed-short' })
  const longSession = generateSessionExercises(input, 'upper', 120, input.goals.primary, { seed: 'seed-long' })

  assert.ok(shortSession.length > 0)
  assert.ok(longSession.length >= shortSession.length)
  const shortSets = shortSession.reduce((sum, ex) => sum + ex.sets, 0)
  const longSets = longSession.reduce((sum, ex) => sum + ex.sets, 0)
  assert.ok(longSets >= shortSets)
})

test('filters exercises to available equipment inventory', () => {
  const input = normalizePlanInput({
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

  const allExercises = generateSessionExercises(input, 'core', 40, input.goals.primary, { seed: 'seed-core' })
  assert.ok(allExercises.length > 0)
  assert.ok(allExercises.every(exercise => exercise.equipment.some(option => option.kind === 'bodyweight')))
})

test('intensity and experience change prescriptions', () => {
  const baseInput = normalizePlanInput({
    intent: { mode: 'body_part', bodyParts: ['upper'] },
    preferences: { focusAreas: ['upper'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  const lowIntensity = generateSessionExercises(
    { ...baseInput, intensity: 'low' },
    'upper',
    45,
    baseInput.goals.primary,
    { seed: 'seed-intensity' }
  )
  const highIntensity = generateSessionExercises(
    { ...baseInput, intensity: 'high' },
    'upper',
    45,
    baseInput.goals.primary,
    { seed: 'seed-intensity' }
  )

  const lowRest = lowIntensity.reduce((sum, ex) => sum + ex.restSeconds, 0)
  const highRest = highIntensity.reduce((sum, ex) => sum + ex.restSeconds, 0)
  assert.notEqual(lowRest, highRest)

  const beginner = generateSessionExercises(
    { ...baseInput, experienceLevel: 'beginner' },
    'upper',
    45,
    baseInput.goals.primary,
    { seed: 'seed-experience' }
  )
  const advanced = generateSessionExercises(
    { ...baseInput, experienceLevel: 'advanced' },
    'upper',
    45,
    baseInput.goals.primary,
    { seed: 'seed-experience' }
  )
  const beginnerSets = beginner.reduce((sum, ex) => sum + ex.sets, 0)
  const advancedSets = advanced.reduce((sum, ex) => sum + ex.sets, 0)
  assert.notEqual(beginner[0].sets, advanced[0].sets)
})

test('repeated runs vary while avoiding back-to-back duplicates', () => {
  const input = normalizePlanInput({
    intent: { mode: 'body_part', bodyParts: ['back'] },
    preferences: { focusAreas: ['back'], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
  })

  const firstRun = generateSessionExercises(input, 'back', 45, input.goals.primary, { seed: 'run-1' })
  const history = {
    recentExerciseNames: firstRun.map(ex => ex.name),
    recentMovementPatterns: firstRun.map(ex => ex.movementPattern).filter(Boolean),
    recentPrimaryMuscles: firstRun.map(ex => ex.primaryMuscle).filter(Boolean)
  }
  const secondRun = generateSessionExercises(input, 'back', 45, input.goals.primary, { seed: 'run-2', history })

  assert.notEqual(firstRun.map(ex => ex.name).join('|'), secondRun.map(ex => ex.name).join('|'))

  const uniquePatterns = new Set(secondRun.map(ex => ex.movementPattern).filter(Boolean))
  const primaryList = secondRun.map(ex => ex.primaryMuscle).filter(Boolean)
  const uniquePrimary = new Set(primaryList)
  const primaryCounts = primaryList.reduce((acc, muscle) => {
    acc[muscle] = (acc[muscle] ?? 0) + 1
    return acc
  }, {})
  const maxPrimaryCount = Math.max(0, ...Object.values(primaryCounts))
  secondRun.forEach((exercise, index) => {
    const previous = secondRun[index - 1]
    if (!previous) return
    if (uniquePatterns.size > 1 && exercise.movementPattern && previous.movementPattern) {
      assert.notEqual(exercise.movementPattern, previous.movementPattern)
    }
    const prevPrimary = String(previous.primaryMuscle ?? '').toLowerCase()
    const nextPrimary = String(exercise.primaryMuscle ?? '').toLowerCase()
    if (uniquePrimary.size > 1 && maxPrimaryCount <= Math.ceil(secondRun.length / 2) && prevPrimary && nextPrimary) {
      assert.notEqual(prevPrimary, nextPrimary)
    }
  })
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
          loadTarget: 40,
          load: { value: 40, unit: 'lb', label: '2x20 lb dumbbells' }
        }
      ]
    }
  ])

  // Volume: 40lbs * 30 reps = 1200 lbs
  // Intensity: 7 RPE -> 70 Scaled
  // Density: 1200 lbs / 12 min (calculated duration with setup) = 100
  // Score: Workload / 10. Workload = 1200 * 0.57 (RPE 7 factor) = ~685. Score ~69.
  assert.equal(impact.breakdown.volume, 1200)
  assert.equal(impact.breakdown.intensity, 70)
  assert.equal(impact.breakdown.density, 100)
  assert.equal(impact.score, 69)
})
