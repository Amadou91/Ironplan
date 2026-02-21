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
const { generateCoachFeedInsights, buildActionScopeSummary, buildFilterScopeSummary } = coachFeedModule

function createBaseInput() {
  return {
    filteredSessionCount: 12,
    sessionsPerWeek: 2.6,
    readinessScore: 68,
    avgEffort: 6.8,
    hardSets: 42,
    timeHorizonLabel: 'Last 14 days',
    trainingLoadSummary: {
      status: 'balanced',
      loadRatio: 1.05,
      insufficientData: false,
      isInitialPhase: false,
      daysSinceLast: 1.2
    }
  }
}

test('generateCoachFeedInsights returns up to two highest-priority forward actions', () => {
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

  assert.equal(insights.length, 2)
  assert.equal(insights[0].id, 'overreaching-load')
  assert.ok(insights.some((insight) => insight.id === 'high-effort-low-readiness'))
  assert.equal(insights[0].timeHorizonLabel, 'Last 14 days')
})

test('generateCoachFeedInsights returns explicit insufficient-data state when no sessions exist in horizon', () => {
  const insights = generateCoachFeedInsights({
    ...createBaseInput(),
    filteredSessionCount: 0,
    sessionsPerWeek: 0,
    readinessScore: null,
    avgEffort: null
  })

  assert.equal(insights.length, 1)
  assert.equal(insights[0].id, 'insufficient-data')
  assert.equal(insights[0].confidence, 'low')
})

test('generateCoachFeedInsights returns stable-on-track when there are no urgent corrections', () => {
  const insights = generateCoachFeedInsights({
    ...createBaseInput(),
    readinessScore: 64,
    avgEffort: 6.4,
    trainingLoadSummary: {
      status: 'balanced',
      loadRatio: 1.01,
      insufficientData: false,
      isInitialPhase: false,
      daysSinceLast: 1
    }
  })

  assert.equal(insights.length, 1)
  assert.equal(insights[0].id, 'stable-on-track')
  assert.equal(insights[0].confidence, 'high')
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

test('buildActionScopeSummary composes horizon + muscle + exercise labels', () => {
  const summary = buildActionScopeSummary({
    selectedMuscle: 'back',
    selectedExercise: 'all',
    timeHorizonLabel: 'Last 14 days'
  })

  assert.equal(summary.parts[0], 'Last 14 days')
  assert.equal(summary.parts[1], 'Back')
  assert.equal(summary.parts[2], 'All exercises')
  assert.equal(summary.label, 'Last 14 days • Back • All exercises')
})
