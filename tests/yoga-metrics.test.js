import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const requireShim = createRequire(import.meta.url)

const transpile = (path) => {
  const source = readFileSync(path, 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
}

// Load units.ts
const unitsPath = join(__dirname, '../src/lib/units.ts')
const unitsCode = transpile(unitsPath)
const unitsModule = { exports: {} }
new Function('module', 'exports', 'require', unitsCode)(unitsModule, unitsModule.exports, requireShim)

// Load session-metrics.ts
const sessionMetricsPath = join(__dirname, '../src/lib/session-metrics.ts')
const sessionMetricsCode = transpile(sessionMetricsPath)
const sessionMetricsModule = { exports: {} }
const requireForSessionMetrics = (id) => {
  if (id === '@/lib/units') return unitsModule.exports
  return requireShim(id)
}
new Function('module', 'exports', 'require', sessionMetricsCode)(sessionMetricsModule, sessionMetricsModule.exports, requireForSessionMetrics)

const { computeSetLoad, computeSetTonnage } = sessionMetricsModule.exports

const mockYogaSet = {
  metricProfile: 'yoga_session',
  reps: null,
  weight: null,
  weightUnit: null,
  rpe: 5, // Intensity: Moderate (0.285)
  rir: null,
  performedAt: new Date().toISOString(),
  durationSeconds: 3600, // 60 minutes
  completed: true
}

const mockStrengthSet = {
  metricProfile: 'strength',
  reps: 10,
  weight: 135,
  weightUnit: 'lb',
  rpe: 7, // Intensity: Moderate (0.57)
  rir: null,
  performedAt: new Date().toISOString(),
  completed: true
}

test('Yoga Metrics: computeSetTonnage returns 0 for Yoga set', () => {
  const tonnage = computeSetTonnage(mockYogaSet)
  assert.equal(tonnage, 0)
})

test('Yoga Metrics: computeSetLoad returns normalized workload', () => {
  // 60 min * 0.285 (RPE 5) * 450 (Factor) ≈ 7700
  const load = computeSetLoad(mockYogaSet)
  console.log('Yoga Load:', load)
  assert.ok(load > 7000)
  assert.ok(load < 8500)
})

test('Yoga Metrics: computeSetLoad handles missing intensity (defaults to moderate)', () => {
  const noIntensitySet = { ...mockYogaSet, rpe: null }
  const load = computeSetLoad(noIntensitySet)
  // RPE null -> 0.5 intensity (default in units.ts)
  // 60 * 0.5 * 450 = 13500
  console.log('Yoga Load (No RPE):', load)
  assert.equal(load, 60 * 0.5 * 450)
})

test('Yoga Metrics: Strength set uses Tonnage based calculation', () => {
  // 135lb * 10 reps = 1350 tonnage
  // RPE 7 -> (7-3)/7 = 0.5714
  // Load = 1350 * 0.5714 ≈ 771
  const load = computeSetLoad(mockStrengthSet)
  console.log('Strength Load:', load)
  assert.ok(load > 700)
  assert.ok(load < 800)
  // Note: Strength set (1 set) is much lower than 60 min Yoga session (which is expected).
  // A full session would have 10-20 sets.
})