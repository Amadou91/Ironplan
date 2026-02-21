
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 1. Read and Transpile Source
const sourcePath = join(__dirname, '../src/lib/body-measurements.ts')
const sourceCode = readFileSync(sourcePath, 'utf8')

const { outputText: transpileOutput } = ts.transpileModule(sourceCode, {
  compilerOptions: { 
    module: ts.ModuleKind.CommonJS, 
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  }
})

// 2. Mock Environment
const mockModuleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)

// Mock Date Utils
const mockDateUtils = {
  formatDateInET: (date) => {
    // Basic mock: returns YYYY-MM-DD based on UTC input for simplicity in test
    // Real implementation converts to ET.
    // Here we just want to see what date object is passed.
    return date.toISOString().split('T')[0]
  },
  getUTCDateRangeFromET: (dateStr) => {
    return { start: dateStr + 'T00:00:00Z', end: dateStr + 'T23:59:59Z' }
  }
}

const customRequire = (name) => {
  if (name.includes('date-utils')) return mockDateUtils
  return requireShim(name)
}

// 3. Execute Module
const moduleFactory = new Function('module', 'exports', 'require', transpileOutput)
moduleFactory(mockModuleShim, mockModuleShim.exports, customRequire)
const { recordBodyWeight } = mockModuleShim.exports

// 4. Tests
describe('recordBodyWeight', () => {
  
  const createMockSupabase = (store) => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                maybeSingle: async () => ({ data: null }) 
              })
            })
          })
        })
      }),
      insert: async (data) => {
        store.push(data)
        return { error: null }
      },
      update: () => ({ eq: async () => ({ error: null }) })
    })
  })

  it('converts YYYY-MM-DD string to Noon UTC to prevent date shift', async () => {
    const store = []
    const supabase = createMockSupabase(store)
    const dateStr = '2026-02-20'
    
    await recordBodyWeight({
      supabase,
      userId: 'u1',
      weightLb: 150,
      date: dateStr,
      source: 'user'
    })
    
    assert.equal(store.length, 1)
    const recordedAt = new Date(store[0].recorded_at)
    
    // Should be Feb 20 (UTC)
    // Note: Hour depends on local timezone (e.g. 17:00 UTC if EST), but Date must be 20.
    assert.equal(recordedAt.getUTCDate(), 20)
  })

  it('preserves ISO string input', async () => {
    const store = []
    const supabase = createMockSupabase(store)
    const isoStr = '2026-02-20T18:00:00.000Z'
    
    await recordBodyWeight({
      supabase,
      userId: 'u1',
      weightLb: 150,
      date: isoStr,
      source: 'session'
    })
    
    assert.equal(store.length, 1)
    assert.equal(store[0].recorded_at, isoStr)
  })

  it('preserves Date object input', async () => {
    const store = []
    const supabase = createMockSupabase(store)
    const dateObj = new Date('2026-02-20T10:00:00Z')
    
    await recordBodyWeight({
      supabase,
      userId: 'u1',
      weightLb: 150,
      date: dateObj,
      source: 'user'
    })
    
    assert.equal(store.length, 1)
    assert.equal(new Date(store[0].recorded_at).toISOString(), dateObj.toISOString())
  })
})
