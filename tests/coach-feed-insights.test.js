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
const moduleCache = new Map()

function loadTsModule(modulePath) {
  if (moduleCache.has(modulePath)) return moduleCache.get(modulePath)

  const moduleSource = readFileSync(modulePath, 'utf8')
  const { outputText } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  })

  const moduleShim = { exports: {} }
  const moduleDir = dirname(modulePath)

  const contextRequire = (moduleId) => {
    if (moduleId.startsWith('@/')) {
      const relativePath = moduleId.replace('@/', '')
      const resolved = join(__dirname, '../src', `${relativePath}.ts`)
      if (existsSync(resolved)) return loadTsModule(resolved)

      const resolvedTsx = join(__dirname, '../src', `${relativePath}.tsx`)
      if (existsSync(resolvedTsx)) return loadTsModule(resolvedTsx)

      const resolvedIndex = join(__dirname, '../src', relativePath, 'index.ts')
      if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex)

      return loadTsModule(resolved)
    }

    if (moduleId.startsWith('.')) {
      const resolvedCandidate = join(moduleDir, moduleId)
      const resolvedTs = `${resolvedCandidate}.ts`
      if (existsSync(resolvedTs)) return loadTsModule(resolvedTs)
    }

    return requireShim(moduleId)
  }

  const factory = new Function('module', 'exports', 'require', outputText)
  factory(moduleShim, moduleShim.exports, contextRequire)
  moduleCache.set(modulePath, moduleShim.exports)
  return moduleShim.exports
}

const coachFeedModule = loadTsModule(join(__dirname, '../src/lib/progress/coach-feed.ts'))
const { generateCoachFeedInsights, buildFilterScopeSummary } = coachFeedModule

function createBaseInput() {
  return {
    filteredSessionCount: 12,
    sessionsPerWeek: 2.6,
    readinessScore: 68,
    avgEffort: 6.8,
    hardSets: 42,
    trainingLoadSummary: {
      status: 'balanced',
      loadRatio: 1.05,
      insufficientData: false,
      isInitialPhase: false,
      daysSinceLast: 1.2
    },
    exerciseTrend: [
      { e1rm: 210, trend: 205, momentum: null },
      { e1rm: 215, trend: 208, momentum: 0.12 },
      { e1rm: 218, trend: 210, momentum: 0.14 },
      { e1rm: 220, trend: 212, momentum: 0.16 }
    ],
    muscleBreakdown: [
      { muscle: 'Back', relativePct: 26, imbalanceIndex: 142, daysPerWeek: 2.1 },
      { muscle: 'Chest', relativePct: 11, imbalanceIndex: 65, daysPerWeek: 0.8 },
      { muscle: 'Legs', relativePct: 24, imbalanceIndex: 102, daysPerWeek: 1.9 }
    ]
  }
}

test('generateCoachFeedInsights returns exactly 3 items with highest priority first', () => {
  const insights = generateCoachFeedInsights({
    ...createBaseInput(),
    readinessScore: 32,
    avgEffort: 8.1,
    trainingLoadSummary: {
      status: 'overreaching',
      loadRatio: 1.42,
      insufficientData: false,
      isInitialPhase: false,
      daysSinceLast: 0.4
    }
  })

  assert.equal(insights.length, 3)
  assert.equal(insights[0].id, 'overreaching-load')
  assert.ok(insights.some((insight) => insight.id === 'high-effort-low-readiness'))
})

test('generateCoachFeedInsights handles no-data scopes with actionable fallback insights', () => {
  const insights = generateCoachFeedInsights({
    ...createBaseInput(),
    filteredSessionCount: 0,
    sessionsPerWeek: 0,
    readinessScore: null,
    avgEffort: null,
    muscleBreakdown: [],
    exerciseTrend: []
  })

  assert.equal(insights.length, 3)
  assert.equal(insights[0].id, 'no-data')
  assert.ok(insights.some((insight) => insight.id === 'baseline-data-quality'))
})

test('buildFilterScopeSummary produces coherent scope labels for active filters', () => {
  const summary = buildFilterScopeSummary({
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    selectedMuscle: 'back',
    selectedExercise: 'Barbell Row'
  })

  assert.equal(summary.isFiltered, true)
  assert.equal(summary.parts[0], '2026-01-01 to 2026-02-01')
  assert.equal(summary.parts[1], 'Back')
  assert.equal(summary.parts[2], 'Barbell Row')
  assert.equal(summary.label, '2026-01-01 to 2026-02-01 • Back • Barbell Row')
})
