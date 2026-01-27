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

// Module Loading System
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
      
      // Try resolving as folder with implicit index (if index.ts logic fails)
      // or maybe it's a file without extension in import? (rare in this project)
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
       // Try generic node resolution for non-ts files?
       try {
         return requireShim(moduleId)
       } catch {
         // If requireShim fails, throw original error or similar
         throw new Error(`Cannot resolve module '${moduleId}' from '${modulePath}'`)
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

// Load Mapper Module
const mappersPath = join(__dirname, '../src/lib/generator/mappers.ts')
const mappersModule = loadTsModule(mappersPath)
const { mapCatalogRowToExercise } = mappersModule

test('Category Inference', async (t) => {
  await t.test('infers Cardio from focus area', () => {
    const row = {
      name: 'Test Run',
      focus: 'cardio',
      metric_profile: 'duration'
    }
    const exercise = mapCatalogRowToExercise(row)
    assert.equal(exercise.category, 'Cardio')
  })

  await t.test('infers Cardio from metric profile', () => {
    const row = {
      name: 'Test Cycle',
      focus: 'lower',
      metric_profile: 'cardio_session'
    }
    const exercise = mapCatalogRowToExercise(row)
    assert.equal(exercise.category, 'Cardio')
  })

  await t.test('infers Mobility from yoga focus', () => {
    const row = {
      name: 'Sun Salutation',
      focus: 'mobility',
      metric_profile: 'mobility_session'
    }
    const exercise = mapCatalogRowToExercise(row)
    assert.equal(exercise.category, 'Mobility')
  })

  await t.test('infers Mobility from explicit yoga metric profile', () => {
    const row = {
      name: 'Stretching',
      focus: 'full_body',
      metric_profile: 'mobility_session'
    }
    const exercise = mapCatalogRowToExercise(row)
    assert.equal(exercise.category, 'Mobility')
  })

  await t.test('defaults to Strength', () => {
    const row = {
      name: 'Bench Press',
      focus: 'chest',
      metric_profile: 'strength'
    }
    const exercise = mapCatalogRowToExercise(row)
    assert.equal(exercise.category, 'Strength')
  })

  await t.test('respects explicit category override', () => {
    const row = {
      name: 'Special Exercise',
      category: 'Mobility', // Explicit override
      focus: 'cardio' // conflicting signal
    }
    const exercise = mapCatalogRowToExercise(row)
    assert.equal(exercise.category, 'Mobility')
  })
})
