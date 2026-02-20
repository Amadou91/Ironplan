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

// Simple TS loader for the test
function loadTsModule(modulePath) {
  const moduleSource = readFileSync(modulePath, 'utf8')
  const { outputText } = ts.transpileModule(moduleSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  })
  const moduleShim = { exports: {} }
  const factory = new Function('module', 'exports', 'require', outputText)
  factory(moduleShim, moduleShim.exports, (id) => requireShim(id))
  return moduleShim.exports
}

const dateUtilsPath = join(__dirname, '../src/lib/date-utils.ts')
const { formatDateInET, getUTCDateRangeFromET } = loadTsModule(dateUtilsPath)

test('formatDateInET correctly formats dates to Eastern Time', () => {
  // Feb 20, 2026 02:00:00 UTC is Feb 19, 2026 21:00:00 ET
  const date = new Date('2026-02-20T02:00:00Z')
  assert.strictEqual(formatDateInET(date), '2026-02-19')
  
  // Feb 20, 2026 12:00:00 UTC is Feb 20, 2026 07:00:00 ET
  const date2 = new Date('2026-02-20T12:00:00Z')
  assert.strictEqual(formatDateInET(date2), '2026-02-20')
})

test('getUTCDateRangeFromET returns correct UTC bounds for an ET day', () => {
  const range = getUTCDateRangeFromET('2026-02-19')
  
  // In Feb 2026, ET is UTC-5
  // 2026-02-19 00:00:00 ET should be 2026-02-19 05:00:00 UTC
  assert.strictEqual(range.start, '2026-02-19T05:00:00.000Z')
  
  // 2026-02-19 23:59:59 ET should be 2026-02-20 04:59:59 UTC
  assert.strictEqual(range.end, '2026-02-20T04:59:59.000Z')
})

test('getUTCDateRangeFromET handles Daylight Savings Time transition (March)', () => {
  // DST starts March 8, 2026 in US
  // Before transition: ET is UTC-5
  const rangePre = getUTCDateRangeFromET('2026-03-01')
  assert.strictEqual(rangePre.start, '2026-03-01T05:00:00.000Z')
  
  // After transition: ET is UTC-4
  const rangePost = getUTCDateRangeFromET('2026-07-01')
  assert.strictEqual(rangePost.start, '2026-07-01T04:00:00.000Z')
})
