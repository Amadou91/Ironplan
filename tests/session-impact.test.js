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
const metricsPath = join(__dirname, '../src/lib/workout-metrics.ts')
const equipmentPath = join(__dirname, '../src/lib/equipment.ts')
const generatorSource = readFileSync(generatorPath, 'utf8')
const metricsSource = readFileSync(metricsPath, 'utf8')
const equipmentSource = readFileSync(equipmentPath, 'utf8')

const { outputText: metricsOutput } = ts.transpileModule(metricsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
})
const { outputText: equipmentOutput } = ts.transpileModule(equipmentSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
})
const { outputText: generatorOutput } = ts.transpileModule(generatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
})

const metricsModuleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)
const metricsFactory = new Function('module', 'exports', 'require', metricsOutput)
metricsFactory(metricsModuleShim, metricsModuleShim.exports, requireShim)
const equipmentModuleShim = { exports: {} }
const equipmentFactory = new Function('module', 'exports', 'require', equipmentOutput)
equipmentFactory(equipmentModuleShim, equipmentModuleShim.exports, requireShim)

const requireWithMetrics = (moduleId) => {
  if (moduleId === '@/lib/workout-metrics') {
    return metricsModuleShim.exports
  }
  if (moduleId === './equipment' || moduleId === '@/lib/equipment') {
    return equipmentModuleShim.exports
  }
  return requireShim(moduleId)
}

const generatorModuleShim = { exports: {} }
const generatorFactory = new Function('module', 'exports', 'require', generatorOutput)
generatorFactory(generatorModuleShim, generatorModuleShim.exports, requireWithMetrics)

const { calculateExerciseImpact } = generatorModuleShim.exports

test('calculateExerciseImpact only sums the provided session exercises', () => {
  const dayOneExercises = [
    { sets: 3, reps: 10, rpe: 7, durationMinutes: 12 },
    { sets: 4, reps: 8, rpe: 8, durationMinutes: 16 }
  ]
  const dayTwoExercises = [
    { sets: 2, reps: 12, rpe: 6, durationMinutes: 10 }
  ]

  const dayOneImpact = calculateExerciseImpact(dayOneExercises)
  const dayTwoImpact = calculateExerciseImpact(dayTwoExercises)
  const combinedImpact = calculateExerciseImpact([...dayOneExercises, ...dayTwoExercises])

  assert.notEqual(dayOneImpact.score, combinedImpact.score)
  assert.equal(dayOneImpact.score + dayTwoImpact.score, combinedImpact.score)
})
