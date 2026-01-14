import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const swapPath = join(__dirname, '../src/lib/exercise-swap.ts')
const equipmentPath = join(__dirname, '../src/lib/equipment.ts')
const swapSource = readFileSync(swapPath, 'utf8')
const equipmentSource = readFileSync(equipmentPath, 'utf8')

const { outputText: equipmentOutput } = ts.transpileModule(equipmentSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
})
const { outputText: swapOutput } = ts.transpileModule(swapSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
})

const equipmentModuleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)
const equipmentFactory = new Function('module', 'exports', 'require', equipmentOutput)
equipmentFactory(equipmentModuleShim, equipmentModuleShim.exports, requireShim)

const requireWithEquipment = (moduleId) => {
  if (moduleId === '@/lib/equipment' || moduleId === '../src/lib/equipment') {
    return equipmentModuleShim.exports
  }
  return requireShim(moduleId)
}

const swapModuleShim = { exports: {} }
const swapFactory = new Function('module', 'exports', 'require', swapOutput)
swapFactory(swapModuleShim, swapModuleShim.exports, requireWithEquipment)

const { getSwapSuggestions } = swapModuleShim.exports

test('swap suggestions avoid duplicates and respect equipment', () => {
  const inventory = {
    bodyweight: true,
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
    difficulty: 'intermediate',
    goal: 'strength',
    primaryMuscle: 'Chest',
    sets: 4,
    reps: '5-8',
    rpe: 8,
    equipment: [{ kind: 'barbell' }],
    durationMinutes: 12,
    restSeconds: 120
  }

  const library = [
    current,
    {
      name: 'Dumbbell Bench Press',
      focus: 'upper',
      movementPattern: 'push',
      difficulty: 'intermediate',
      goal: 'strength',
      primaryMuscle: 'Chest',
      sets: 4,
      reps: '6-10',
      rpe: 8,
      equipment: [{ kind: 'dumbbell' }],
      durationMinutes: 12,
      restSeconds: 90
    },
    {
      name: 'Lat Pulldown',
      focus: 'upper',
      movementPattern: 'pull',
      difficulty: 'beginner',
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
