import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const utilsPath = join(__dirname, '../src/lib/muscle-utils.ts')
const source = readFileSync(utilsPath, 'utf8')

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true
  }
})

const moduleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)
const factory = new Function('module', 'exports', 'require', outputText)
factory(moduleShim, moduleShim.exports, requireShim)

const { isMuscleMatch, PRESET_MAPPINGS } = moduleShim.exports

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
