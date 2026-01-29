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

const swapPath = join(__dirname, '../src/lib/exercise-swap.ts')
const swapModule = loadTsModule(swapPath)
const { getSwapSuggestions } = swapModule

test('swap suggestions avoid duplicates and respect equipment', () => {
  const inventory = {
    bodyweight: true,
    benchPress: true,
    dumbbells: [20],
    kettlebells: [],
    bands: [],
    barbell: { available: false, plates: [] },
    machines: { cable: false, leg_press: false, treadmill: false, rower: false }
  }

  const current = {
    name: 'Bench Press',
    focus: 'upper',
    movementPattern: 'push',
    goal: 'strength',
    primaryMuscle: 'Chest',
    sets: 4,
    reps: '5-8',
    rpe: 8,
    equipment: [{ kind: 'barbell', requires: ['bench_press'] }],
    durationMinutes: 12,
    restSeconds: 120
  }

  const library = [
    current,
    {
      name: 'Dumbbell Bench Press',
      focus: 'upper',
      movementPattern: 'push',
      goal: 'strength',
      primaryMuscle: 'Chest',
      sets: 4,
      reps: '6-10',
      rpe: 8,
      equipment: [{ kind: 'dumbbell', requires: ['bench_press'] }],
      durationMinutes: 12,
      restSeconds: 90
    },
    {
      name: 'Lat Pulldown',
      focus: 'upper',
      movementPattern: 'pull',
      goal: 'hypertrophy',
      primaryMuscle: 'Back',
      sets: 3,
      reps: '8-12',
      rpe: 7,
      equipment: [{ kind: 'machine', machineType: 'cable' }],
      durationMinutes: 9,
      restSeconds: 90
    }
  ]

  const { suggestions } = getSwapSuggestions({
    current,
    sessionExercises: [current],
    inventory,
    library
  })

  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].exercise.name, 'Dumbbell Bench Press')
})

test('swap suggestions restrict to overlapping muscle groups for leg day', () => {
  const inventory = {
    bodyweight: true,
    benchPress: false,
    dumbbells: [15],
    kettlebells: [],
    bands: [],
    barbell: { available: true, plates: [45] },
    machines: { cable: true, leg_press: true, treadmill: false, rower: false }
  }

  const current = {
    name: 'Back Squat',
    focus: 'lower',
    movementPattern: 'squat',
    goal: 'strength',
    primaryMuscle: 'Quads',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    sets: 4,
    reps: '6-8',
    rpe: 8,
    equipment: [{ kind: 'barbell' }],
    durationMinutes: 15,
    restSeconds: 150
  }

  const library = [
    current,
    {
      name: 'Leg Press',
      focus: 'lower',
      movementPattern: 'squat',
      goal: 'hypertrophy',
      primaryMuscle: 'Quads',
      secondaryMuscles: ['Glutes'],
      sets: 3,
      reps: '10-12',
      rpe: 7,
      equipment: [{ kind: 'machine', machineType: 'leg_press' }],
      durationMinutes: 12,
      restSeconds: 90
    },
    {
      name: 'Bench Press',
      focus: 'upper',
      movementPattern: 'push',
      goal: 'strength',
      primaryMuscle: 'Chest',
      sets: 4,
      reps: '6-8',
      rpe: 8,
      equipment: [{ kind: 'barbell', requires: ['bench_press'] }],
      durationMinutes: 12,
      restSeconds: 120
    }
  ]

  const { suggestions } = getSwapSuggestions({
    current,
    sessionExercises: [current],
    inventory,
    library
  })

  assert.ok(suggestions.length > 0)
  assert.ok(suggestions.every((suggestion) => suggestion.exercise.primaryMuscle === 'Quads'))
})

test('swap suggestions restrict to overlapping muscle groups for upper-body day', () => {
  const inventory = {
    bodyweight: true,
    benchPress: false,
    dumbbells: [25],
    kettlebells: [],
    bands: [],
    barbell: { available: true, plates: [45] },
    machines: { cable: true, leg_press: false, treadmill: false, rower: false }
  }

  const current = {
    name: 'Pull Up',
    focus: 'upper',
    movementPattern: 'pull',
    goal: 'strength',
    primaryMuscle: 'Back',
    secondaryMuscles: ['Biceps'],
    sets: 4,
    reps: 8,
    rpe: 8,
    equipment: [{ kind: 'bodyweight' }],
    durationMinutes: 10,
    restSeconds: 90
  }

  const library = [
    current,
    {
      name: 'Lat Pulldown',
      focus: 'upper',
      movementPattern: 'pull',
      goal: 'hypertrophy',
      primaryMuscle: 'Back',
      secondaryMuscles: ['Biceps'],
      sets: 3,
      reps: '10-12',
      rpe: 7,
      equipment: [{ kind: 'machine', machineType: 'cable' }],
      durationMinutes: 8,
      restSeconds: 75
    },
    {
      name: 'Walking Lunge',
      focus: 'lower',
      movementPattern: 'squat',
      goal: 'hypertrophy',
      primaryMuscle: 'Quads',
      secondaryMuscles: ['Glutes'],
      sets: 3,
      reps: '10-12',
      rpe: 7,
      equipment: [{ kind: 'dumbbell' }],
      durationMinutes: 10,
      restSeconds: 60
    }
  ]

  const { suggestions } = getSwapSuggestions({
    current,
    sessionExercises: [current],
    inventory,
    library
  })

  assert.ok(suggestions.length > 0)
  assert.ok(suggestions.every((suggestion) => suggestion.exercise.primaryMuscle === 'Back'))
})
