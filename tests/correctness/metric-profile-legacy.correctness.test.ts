/**
 * Legacy Metric Profile Correctness Tests
 *
 * Ensures legacy profile aliases are interpreted consistently by metric calculations.
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

const sessionMetrics = loadTsModule(
  join(__dirname, '../../src/lib/session-metrics.ts')
) as {
  computeSetE1rm: (set: Record<string, unknown>, goal?: unknown, eligible?: boolean) => number | null
  isHardSet: (set: Record<string, unknown>) => boolean
}

test('Legacy profile alias: weight-reps remains E1RM eligible', () => {
  const e1rm = sessionMetrics.computeSetE1rm(
    {
      metricProfile: 'weight-reps',
      reps: 8,
      weight: 100,
      weightUnit: 'lb',
      rpe: 9,
      completed: true
    },
    null,
    true
  )

  assert.notEqual(e1rm, null)
  assert.ok((e1rm ?? 0) > 0)
})

test('Legacy profile alias: weight_reps remains hard-set eligible', () => {
  const hard = sessionMetrics.isHardSet({
    metricProfile: 'weight_reps',
    reps: 10,
    weight: 95,
    weightUnit: 'lb',
    rpe: 8,
    completed: true
  })

  assert.equal(hard, true)
})
