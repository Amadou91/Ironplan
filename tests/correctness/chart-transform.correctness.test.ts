/**
 * Chart Transform Correctness Tests
 *
 * Verifies chart aggregation preserves mixed-modality semantics:
 * - Strength contributes to volume + load
 * - Cardio/mobility contributes to load only (via duration)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const requireShim = createRequire(import.meta.url)
const moduleCache = new Map()

function loadTsModule(modulePath: string): Record<string, unknown> {
  if (moduleCache.has(modulePath)) return moduleCache.get(modulePath) as Record<string, unknown>

  const moduleSource = readFileSync(modulePath, 'utf8')
  const { outputText: moduleOutput } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  })

  const moduleShim = { exports: {} as Record<string, unknown> }
  const moduleDir = dirname(modulePath)

  const contextRequire = (moduleId: string): unknown => {
    if (moduleId.startsWith('@/')) {
      const relativePath = moduleId.replace('@/', '')
      const resolved = join(__dirname, '../../src', `${relativePath}.ts`)
      if (existsSync(resolved)) return loadTsModule(resolved)
      const resolvedIndex = join(__dirname, '../../src', relativePath, 'index.ts')
      if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex)
      return loadTsModule(resolved)
    }
    if (moduleId.startsWith('.')) {
      const resolvedCandidate = join(moduleDir, moduleId)
      if (existsSync(resolvedCandidate + '.ts')) return loadTsModule(resolvedCandidate + '.ts')
    }
    return requireShim(moduleId)
  }

  const factory = new Function('module', 'exports', 'require', moduleOutput)
  factory(moduleShim, moduleShim.exports, contextRequire)
  moduleCache.set(modulePath, moduleShim.exports)
  return moduleShim.exports
}

const chartData = loadTsModule(
  join(__dirname, '../../src/lib/transformers/chart-data.ts')
) as {
  transformSessionsToVolumeTrend: (
    allSets: Array<Record<string, unknown>>,
    filteredSessions: Array<{ started_at: string }>,
    options?: { startDate?: string; endDate?: string }
  ) => Array<{ label: string; volume: number; load: number; isDaily: boolean }>
}

const sessionMetrics = loadTsModule(
  join(__dirname, '../../src/lib/session-metrics.ts')
) as {
  computeSetLoad: (set: Record<string, unknown>) => number
}

test('Volume trend preserves mixed-modality semantics', () => {
  const day = '2026-02-01T10:00:00.000Z'

  const strengthSet = {
    metricProfile: 'reps_weight',
    reps: 10,
    weight: 100,
    weight_unit: 'lb',
    rpe: 8,
    performed_at: day
  }

  const cardioSet = {
    metricProfile: 'cardio_session',
    reps: null,
    weight: null,
    duration_seconds: 1800,
    rpe: 7,
    performed_at: day
  }

  const points = chartData.transformSessionsToVolumeTrend(
    [strengthSet, cardioSet],
    [{ started_at: day }],
    { startDate: '2026-02-01', endDate: '2026-02-07' }
  )

  assert.equal(points.length, 1, 'expected a single daily aggregate bucket')
  assert.equal(points[0].isDaily, true)

  const expectedVolume = 1000
  const expectedLoad = Math.round(
    sessionMetrics.computeSetLoad({
      metricProfile: 'reps_weight',
      reps: 10,
      weight: 100,
      weightUnit: 'lb',
      rpe: 8
    }) +
      sessionMetrics.computeSetLoad({
        metricProfile: 'cardio_session',
        durationSeconds: 1800,
        rpe: 7
      })
  )

  assert.equal(points[0].volume, expectedVolume, 'volume should include only weighted strength tonnage')
  assert.equal(points[0].load, expectedLoad, 'load should include both strength and cardio duration load')
})
