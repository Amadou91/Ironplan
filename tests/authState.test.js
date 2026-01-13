import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const loadModule = (relativePath) => {
  const modulePath = join(__dirname, relativePath)
  const source = readFileSync(modulePath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  })
  const moduleShim = { exports: {} }
  const requireShim = createRequire(import.meta.url)
  const factory = new Function('module', 'exports', 'require', outputText)
  factory(moduleShim, moduleShim.exports, requireShim)
  return moduleShim.exports
}

const { createAuthStore } = loadModule('../src/store/authStore.ts')
const { getAuthNavState } = loadModule('../src/lib/authUi.ts')

const createMemoryStorage = () => {
  const data = new Map()
  return {
    getItem: (name) => (data.has(name) ? data.get(name) : null),
    setItem: (name, value) => {
      data.set(name, value)
    },
    removeItem: (name) => {
      data.delete(name)
    }
  }
}

test('login updates nav state', () => {
  const storage = createMemoryStorage()
  const store = createAuthStore(storage)

  store.getState().setUser({ id: 'user-1', email: 'trainer@example.com' })
  const navState = getAuthNavState(store.getState().user)

  assert.equal(navState.actionLabel, 'Log Out')
  assert.match(navState.greeting, /trainer/)
})

test('refresh preserves nav state', async () => {
  const storage = createMemoryStorage()
  const store = createAuthStore(storage)
  store.getState().setUser({ id: 'user-2', email: 'athlete@example.com' })

  const rehydratedStore = createAuthStore(storage)
  await rehydratedStore.persist.rehydrate()

  assert.deepEqual(rehydratedStore.getState().user, {
    id: 'user-2',
    email: 'athlete@example.com'
  })
})

test('logout returns nav to Log In', () => {
  const storage = createMemoryStorage()
  const store = createAuthStore(storage)
  store.getState().setUser({ id: 'user-3', email: 'coach@example.com' })

  store.getState().clearUser()
  const navState = getAuthNavState(store.getState().user)

  assert.equal(navState.actionLabel, 'Log In')
  assert.equal(navState.greeting, null)
})
