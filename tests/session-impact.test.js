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

// Load the generator impact-utils module
const impactPath = join(__dirname, '../src/lib/generator/impact-utils.ts')
const impactModule = loadTsModule(impactPath)
const { calculateExerciseImpact } = impactModule

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
