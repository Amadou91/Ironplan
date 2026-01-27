import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const flowPath = join(__dirname, '../src/lib/generationFlow.ts')
const source = readFileSync(flowPath, 'utf8')

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
})

const unitsPath = join(__dirname, '../src/lib/units.ts')
const unitsSource = readFileSync(unitsPath, 'utf8')
const { outputText: unitsOutput } = ts.transpileModule(unitsSource, {
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
const unitsModuleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)

const customRequire = (moduleId) => {
  if (moduleId === './equipment' || moduleId === '../src/lib/equipment') {
    return equipmentModuleShim.exports
  }
  if (moduleId === '@/lib/units') {
    return unitsModuleShim.exports
  }
  return requireShim(moduleId)
}

const unitsFactory = new Function('module', 'exports', 'require', unitsOutput)
unitsFactory(unitsModuleShim, unitsModuleShim.exports, customRequire)

const equipmentFactory = new Function('module', 'exports', 'require', equipmentOutput)
equipmentFactory(equipmentModuleShim, equipmentModuleShim.exports, customRequire)

const factory = new Function('module', 'exports', 'require', outputText)
factory(moduleShim, moduleShim.exports, customRequire)

const { getFlowCompletion } = moduleShim.exports

const baseInput = {
  goals: { primary: 'strength', priority: 'primary' },
  experienceLevel: 'intermediate',
  intensity: 'moderate',
  equipment: {
    preset: 'full_gym',
    inventory: {
      bodyweight: true,
      dumbbells: [10, 20],
      kettlebells: [],
      bands: ['light'],
      barbell: { available: true, plates: [10, 25, 45] },
      machines: { cable: true, leg_press: false, treadmill: true, rower: false }
    }
  },
  time: { minutesPerSession: 45 },
  schedule: { daysAvailable: [1, 3], timeWindows: ['evening'], minRestDays: 1 },
  preferences: { focusAreas: [], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
}

test('gates duration step until days available are selected', () => {
  const flowState = getFlowCompletion({
    ...baseInput,
    schedule: { ...baseInput.schedule, daysAvailable: [] }
  })

  assert.equal(flowState.durationStepComplete, false)
  assert.equal(flowState.isFormValid, false)
})

test('requires total minutes to remain within range when provided', () => {
  const flowState = getFlowCompletion({
    ...baseInput,
    time: { minutesPerSession: 45, totalMinutesPerWeek: 500 }
  })

  assert.equal(flowState.durationStepComplete, false)
  assert.equal(flowState.isFormValid, false)
})

test('enables generation when required steps are complete', () => {
  const flowState = getFlowCompletion({
    ...baseInput,
    time: { minutesPerSession: 45, totalMinutesPerWeek: 180 }
  })

  assert.equal(flowState.isFormValid, true)
})
