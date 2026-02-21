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

const navigationModule = loadTsModule(join(__dirname, '../src/lib/navigation.ts'))
const sessionUiModule = loadTsModule(join(__dirname, '../src/lib/session-ui.ts'))

const { isNavRouteActive } = navigationModule
const { getSessionCompletionPct, formatSessionSyncLabel } = sessionUiModule

test('isNavRouteActive handles exact and nested matches', () => {
  assert.equal(isNavRouteActive('/dashboard', '/dashboard'), true)
  assert.equal(isNavRouteActive('/progress/charts', '/progress'), true)
  assert.equal(isNavRouteActive('/profile', '/dashboard'), false)
})

test('isNavRouteActive supports workout legacy path mapping', () => {
  assert.equal(isNavRouteActive('/workout/123', '/exercises'), true)
  assert.equal(isNavRouteActive('/workout/123', '/progress'), false)
})

test('getSessionCompletionPct clamps values safely', () => {
  assert.equal(getSessionCompletionPct({ completedSets: 0, totalSets: 0 }), 0)
  assert.equal(getSessionCompletionPct({ completedSets: 3, totalSets: 10 }), 30)
  assert.equal(getSessionCompletionPct({ completedSets: 15, totalSets: 10 }), 100)
})

test('formatSessionSyncLabel returns accurate label/tone', () => {
  assert.deepEqual(formatSessionSyncLabel({ state: 'synced', pending: 0, error: 0 }, true), {
    label: 'All changes synced',
    tone: 'success'
  })

  assert.deepEqual(formatSessionSyncLabel({ state: 'pending', pending: 2, error: 0 }, true), {
    label: 'Syncing 2 changes',
    tone: 'primary'
  })

  assert.deepEqual(formatSessionSyncLabel({ state: 'error', pending: 0, error: 1 }, true), {
    label: 'Sync issue (1)',
    tone: 'danger'
  })

  assert.deepEqual(formatSessionSyncLabel({ state: 'pending', pending: 4, error: 0 }, false), {
    label: 'Offline: changes saved locally',
    tone: 'warning'
  })
})
