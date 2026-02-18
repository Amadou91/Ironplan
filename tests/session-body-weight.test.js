import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const creationPath = join(__dirname, '../src/lib/session-creation.ts')
const creationSource = readFileSync(creationPath, 'utf8')

const { outputText: creationOutput } = ts.transpileModule(creationSource, {
  compilerOptions: { 
    module: ts.ModuleKind.CommonJS, 
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  }
})

// Mock dependencies
const mockGenerator = {
  generateSessionExercisesForFocusAreas: () => [],
  calculateExerciseImpact: () => ({ score: 0 })
}

const mockModuleShim = { exports: {} }
const requireShim = createRequire(import.meta.url)
const creationFactory = new Function('module', 'exports', 'require', creationOutput)

// Minimal shim for dependencies
const customRequire = (name) => {
  if (name.includes('generator')) return mockGenerator
  if (name.includes('muscle-utils')) return { toMuscleLabel: (s) => s, toMuscleSlug: (s) => s }
  if (name.includes('session-focus')) {
    return {
      resolveSessionFocusAreas: (areas) => areas ?? ['full_body'],
      getPrimaryFocusArea: (areas) => areas?.[0] ?? 'full_body'
    }
  }
  if (name.includes('workout-naming')) return { buildWorkoutDisplayName: () => 'Test Session' }
  return requireShim(name)
}

creationFactory(mockModuleShim, mockModuleShim.exports, customRequire)
const { createWorkoutSession } = mockModuleShim.exports

test('createWorkoutSession includes bodyWeightLb in database insert', async () => {
  let capturedInsert = null

  const mockSupabase = {
    from: (table) => ({
      insert: (data) => {
        if (table === 'sessions') capturedInsert = data
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'session-123' }, error: null })
          })
        }
      },
      update: () => ({
        eq: () => Promise.resolve({ error: null })
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null })
        })
      })
    })
  }

  const params = {
    supabase: mockSupabase,
    userId: 'user-123',
    templateId: 'temp-123',
    templateTitle: 'Upper Body',
    focusAreas: ['upper'],
    goal: 'strength',
    input: { intensity: 'moderate' },
    minutesAvailable: 45,
    readiness: {
      survey: { sleep: 4, soreness: 2, stress: 2, motivation: 4 },
      score: 80,
      level: 'steady'
    },
    bodyWeightLb: 185.5
  }

  await createWorkoutSession(params)

  assert.ok(capturedInsert, 'Should have inserted into sessions')
  assert.equal(capturedInsert.body_weight_lb, 185.5, 'Should include bodyWeightLb in insert')
})

test('createWorkoutSession falls back to profile weight if bodyWeightLb is missing', async () => {
  let capturedInsert = null

  const mockSupabase = {
    from: (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { weight_lb: 190.2 }, error: null })
            })
          })
        }
      }
      return {
        insert: (data) => {
          if (table === 'sessions') capturedInsert = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'session-456' }, error: null })
            })
          }
        },
        update: () => ({
          eq: () => Promise.resolve({ error: null })
        })
      }
    }
  }

  const params = {
    supabase: mockSupabase,
    userId: 'user-123',
    templateId: 'temp-123',
    templateTitle: 'Upper Body',
    focusAreas: ['upper'],
    goal: 'strength',
    input: { intensity: 'moderate' },
    minutesAvailable: 45,
    readiness: {
      survey: { sleep: 4, soreness: 2, stress: 2, motivation: 4 },
      score: 80,
      level: 'steady'
    },
    bodyWeightLb: null
  }

  await createWorkoutSession(params)

  assert.ok(capturedInsert, 'Should have inserted into sessions')
  assert.equal(capturedInsert.body_weight_lb, 190.2, 'Should fall back to profile weight')
})
