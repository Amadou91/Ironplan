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

  const source = readFileSync(modulePath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
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

      const resolvedIndex = join(__dirname, '../src', relativePath, 'index.ts')
      if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex)

      return loadTsModule(resolved)
    }

    if (moduleId.startsWith('.')) {
      const resolvedCandidate = join(moduleDir, moduleId)
      const resolvedTs = `${resolvedCandidate}.ts`
      if (existsSync(resolvedTs)) {
        return loadTsModule(resolvedTs)
      }

      const resolvedIndex = join(resolvedCandidate, 'index.ts')
      if (existsSync(resolvedIndex)) {
        return loadTsModule(resolvedIndex)
      }
    }

    return requireShim(moduleId)
  }

  const factory = new Function('module', 'exports', 'require', outputText)
  factory(moduleShim, moduleShim.exports, contextRequire)
  moduleCache.set(modulePath, moduleShim.exports)
  return moduleShim.exports
}

const sessionFocusPath = join(__dirname, '../src/lib/session-focus.ts')
const moduleExports = loadTsModule(sessionFocusPath)
const { resolveArmFocusTargets } = moduleExports

test('resolveArmFocusTargets keeps generic arms when no targets are selected', () => {
  assert.deepEqual(resolveArmFocusTargets(['arms'], []), ['arms'])
})

test('resolveArmFocusTargets expands arms into selected targets', () => {
  assert.deepEqual(resolveArmFocusTargets(['arms'], ['biceps']), ['biceps'])
  assert.deepEqual(resolveArmFocusTargets(['arms'], ['triceps']), ['triceps'])
  assert.deepEqual(resolveArmFocusTargets(['arms'], ['biceps', 'triceps']), ['biceps', 'triceps'])
})

test('resolveArmFocusTargets preserves non-arm focus areas', () => {
  assert.deepEqual(resolveArmFocusTargets(['arms', 'chest'], ['triceps']), ['triceps', 'chest'])
  assert.deepEqual(resolveArmFocusTargets(['chest', 'back'], ['biceps']), ['chest', 'back'])
})
