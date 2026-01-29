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

const utilsPath = join(__dirname, '../src/lib/muscle-utils.ts')
const moduleExports = loadTsModule(utilsPath)
const { isMuscleMatch } = moduleExports

test('isMuscleMatch matches primary muscle', () => {
  assert.equal(isMuscleMatch('chest', 'Chest'), true)
  assert.equal(isMuscleMatch('chest', 'back'), false)
})

test('isMuscleMatch matches secondary muscle', () => {
  assert.equal(isMuscleMatch('arms', 'Chest', ['Triceps', 'Shoulders']), true)
  assert.equal(isMuscleMatch('arms', 'Chest', ['Shoulders']), false)
})

test('Arms preset includes Biceps and Triceps', () => {
  assert.equal(isMuscleMatch('arms', 'Biceps'), true)
  assert.equal(isMuscleMatch('arms', 'Triceps'), true)
  assert.equal(isMuscleMatch('arms', 'Forearms'), true)
})

test('Legs preset includes Quads, Hamstrings, Glutes', () => {
  // Note: in MUSCLE_PRESETS we changed 'quads' to 'legs'
  assert.equal(isMuscleMatch('legs', 'Quads'), true)
  assert.equal(isMuscleMatch('legs', 'Hamstrings'), true)
  assert.equal(isMuscleMatch('legs', 'Glutes'), true)
  assert.equal(isMuscleMatch('legs', 'Calves'), true)
})

test('Chest preset includes secondary Triceps when filtered by Arms', () => {
  // Case: Bench Press (Primary: Chest, Secondary: Triceps)
  // User selects "Arms" preset.
  assert.equal(isMuscleMatch('arms', 'Chest', ['Triceps']), true)
})

test('All preset matches everything', () => {
  assert.equal(isMuscleMatch('all', 'Chest'), true)
  assert.equal(isMuscleMatch('all', 'Any'), true)
})
