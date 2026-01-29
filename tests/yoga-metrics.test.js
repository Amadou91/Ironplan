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

// Load session-metrics.ts
const sessionMetricsPath = join(__dirname, '../src/lib/session-metrics.ts')
const sessionMetricsModule = loadTsModule(sessionMetricsPath)
const { computeSetLoad, computeSetTonnage } = sessionMetricsModule

const mockYogaSet = {
  metricProfile: 'mobility_session',
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

test('Mobility Metrics: computeSetTonnage returns 0 for Yoga set', () => {
  const tonnage = computeSetTonnage(mockYogaSet)
  assert.equal(tonnage, 0)
})

test('Mobility Metrics: computeSetLoad returns normalized workload', () => {
  // 60 min * intensityFactor * 215 (TIME_LOAD_FACTOR)
  // RPE 5 -> intensityFactor via normalizeIntensity
  const load = computeSetLoad(mockYogaSet)
  console.log('Yoga Load:', load)
  // With TIME_LOAD_FACTOR = 215, expect ~3500-4000
  assert.ok(load > 3000)
  assert.ok(load < 4500)
})

test('Mobility Metrics: computeSetLoad handles missing intensity (defaults to moderate)', () => {
  const noIntensitySet = { ...mockYogaSet, rpe: null }
  const load = computeSetLoad(noIntensitySet)
  // RPE null -> 0.5 intensity (default)
  // 60 * 0.5 * 215 = 6450
  console.log('Yoga Load (No RPE):', load)
  assert.equal(load, 60 * 0.5 * 215)
})

test('Mobility Metrics: Strength set uses Tonnage based calculation', () => {
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