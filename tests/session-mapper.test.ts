import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';

// --- TypeScript Loading Shim ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const requireShim = createRequire(import.meta.url);
const moduleCache = new Map();

function loadTsModule(modulePath: string): Record<string, unknown> {
  if (moduleCache.has(modulePath)) return moduleCache.get(modulePath);
  const moduleSource = readFileSync(modulePath, 'utf8');
  const { outputText } = ts.transpileModule(moduleSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  });
  const mod = { exports: {} as Record<string, unknown> };
  const moduleDir = dirname(modulePath);
  const contextRequire = (moduleId: string): unknown => {
    if (moduleId.startsWith('@/')) {
      const rel = moduleId.replace('@/', '');
      const resolved = join(__dirname, '../src', `${rel}.ts`);
      if (existsSync(resolved)) return loadTsModule(resolved);
      const resolvedIndex = join(__dirname, '../src', rel, 'index.ts');
      if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex);
      return loadTsModule(resolved);
    }
    if (moduleId.startsWith('.')) {
      const candidate = join(moduleDir, moduleId);
      if (existsSync(candidate + '.ts')) return loadTsModule(candidate + '.ts');
    }
    return requireShim(moduleId);
  };
  const factory = new Function('module', 'exports', 'require', outputText);
  factory(mod, mod.exports, contextRequire);
  moduleCache.set(modulePath, mod.exports);
  return mod.exports;
}

// Load module under test
const mapperModule = loadTsModule(join(__dirname, '../src/lib/session-mapper.ts'));
const mapSessionPayload = mapperModule.mapSessionPayload as (
  payload: Record<string, unknown>
) => Record<string, unknown>;

test('mapSessionPayload', async (t) => {
  const makePayload = (overrides?: Record<string, unknown>) => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: 'user-1',
    name: 'Test Session',
    template_id: null,
    session_focus: 'upper_body',
    session_goal: 'strength',
    session_intensity: 'moderate',
    started_at: '2026-01-01T10:00:00Z',
    ended_at: null,
    status: 'in_progress',
    timezone: 'America/New_York',
    body_weight_lb: null,
    session_notes: null,
    session_focus_areas: [],
    session_exercises: [],
    ...overrides
  });

  await t.test('maps basic session fields correctly', () => {
    const result = mapSessionPayload(makePayload());
    assert.equal(result.id, '123e4567-e89b-12d3-a456-426614174000');
    assert.equal(result.name, 'Test Session');
    assert.equal(result.status, 'in_progress');
    assert.equal(result.startedAt, '2026-01-01T10:00:00Z');
    assert.equal(result.sessionGoal, 'strength');
    assert.equal(result.sessionIntensity, 'moderate');
  });

  await t.test('maps exercises with sets', () => {
    const payload = makePayload({
      session_exercises: [{
        id: 'ex-1',
        exercise_name: 'Bench Press',
        primary_muscle: 'chest',
        secondary_muscles: ['triceps'],
        metric_profile: null,
        order_index: 0,
        sets: [{
          id: 'set-1',
          set_number: 1,
          reps: 10,
          weight: 135,
          implement_count: null,
          load_type: null,
          rpe: 7,
          rir: 3,
          completed: true,
          performed_at: '2026-01-01T10:05:00Z',
          weight_unit: 'lb',
          duration_seconds: null,
          distance: null,
          distance_unit: null,
          rest_seconds_actual: 90,
          extras: null,
          extra_metrics: null
        }]
      }]
    });
    const result = mapSessionPayload(payload);
    const exercises = result.exercises as Array<Record<string, unknown>>;
    assert.equal(exercises.length, 1);
    assert.equal(exercises[0].name, 'Bench Press');
    const sets = exercises[0].sets as Array<Record<string, unknown>>;
    assert.equal(sets.length, 1);
    assert.equal(sets[0].reps, 10);
    assert.equal(sets[0].weight, 135);
    assert.equal(sets[0].completed, true);
  });

  await t.test('deduplicates exercises by name', () => {
    const makeExercise = (id: string, name: string, setId: string, setNum: number) => ({
      id,
      exercise_name: name,
      primary_muscle: 'chest',
      secondary_muscles: [],
      metric_profile: null,
      order_index: 0,
      sets: [{
        id: setId,
        set_number: setNum,
        reps: 10,
        weight: 100,
        implement_count: null,
        load_type: null,
        rpe: null,
        rir: null,
        completed: true,
        performed_at: null,
        weight_unit: 'lb',
        duration_seconds: null,
        distance: null,
        distance_unit: null,
        rest_seconds_actual: null,
        extras: null,
        extra_metrics: null
      }]
    });

    const payload = makePayload({
      session_exercises: [
        makeExercise('ex-1', 'Bench Press', 'set-1', 1),
        makeExercise('ex-2', 'bench press', 'set-2', 2) // same name, different case
      ]
    });
    const result = mapSessionPayload(payload);
    const exercises = result.exercises as Array<Record<string, unknown>>;
    assert.equal(exercises.length, 1); // Deduplicated
    const sets = exercises[0].sets as Array<Record<string, unknown>>;
    assert.equal(sets.length, 2); // Both sets merged
  });

  await t.test('maps body weight from payload', () => {
    const result = mapSessionPayload(makePayload({ body_weight_lb: 180 }));
    assert.equal(result.bodyWeightLb, 180);
  });

  await t.test('handles null/empty exercises gracefully', () => {
    const result = mapSessionPayload(makePayload({ session_exercises: [] }));
    const exercises = result.exercises as unknown[];
    assert.equal(exercises.length, 0);
  });
});
