import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const savedPath = join(__dirname, '../src/lib/saved-sessions.ts')
const savedSource = readFileSync(savedPath, 'utf8')

const { outputText: savedOutput } = ts.transpileModule(savedSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
})

const savedModuleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)
const savedFactory = new Function('module', 'exports', 'require', savedOutput)
savedFactory(savedModuleShim, savedModuleShim.exports, requireShim)

const { resolveSavedSessionConflicts } = savedModuleShim.exports

test('resolves partial conflicts for selected days', () => {
  const selectedDays = [1, 3, 5]
  const existingSessions = [
    { id: 'a', day_of_week: 3, session_name: 'Midweek', updated_at: '2024-01-01T00:00:00Z' }
  ]

  const result = resolveSavedSessionConflicts(selectedDays, existingSessions)
  assert.deepEqual(result.availableDays, [1, 5])
  assert.equal(result.conflicts.length, 1)
  assert.equal(result.conflicts[0].dayOfWeek, 3)
})
