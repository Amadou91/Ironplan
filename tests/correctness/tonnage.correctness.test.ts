/**
 * External Tonnage (Volume Load) Correctness Tests
 * 
 * CORRECTNESS REQUIREMENT: Tonnage is calculated from EXTERNAL weight only.
 * Formula: reps × externalWeight (lbs)
 * 
 * - No virtual bodyweight inference
 * - No exercise name matching for multipliers
 * - No user bodyweight in calculations
 * 
 * If no external weight is entered, tonnage = 0.
 * 
 * @see docs/METRICS-SPEC.md for detailed specification
 */
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
  const { outputText: moduleOutput } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  });

  const moduleShim = { exports: {} as Record<string, unknown> };
  const moduleDir = dirname(modulePath);

  const contextRequire = (moduleId: string): unknown => {
    if (moduleId.startsWith('@/')) {
      const relativePath = moduleId.replace('@/', '');
      const resolved = join(__dirname, '../../src', `${relativePath}.ts`);
      if (existsSync(resolved)) return loadTsModule(resolved);
      const resolvedIndex = join(__dirname, '../../src', relativePath, 'index.ts');
      if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex);
      return loadTsModule(resolved);
    }
    if (moduleId.startsWith('.')) {
      const resolvedCandidate = join(moduleDir, moduleId);
      if (existsSync(resolvedCandidate + '.ts')) return loadTsModule(resolvedCandidate + '.ts');
    }
    return requireShim(moduleId);
  };

  const factory = new Function('module', 'exports', 'require', moduleOutput);
  factory(moduleShim, moduleShim.exports, contextRequire);
  moduleCache.set(modulePath, moduleShim.exports);
  return moduleShim.exports;
}

// Load fixtures
const fixtures = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/tonnage-fixtures.json'), 'utf8')
);

// Load module under test
const sessionMetrics = loadTsModule(
  join(__dirname, '../../src/lib/session-metrics.ts')
) as {
  computeSetTonnage: (set: Record<string, unknown>) => number;
  computeSetLoad: (set: Record<string, unknown>) => number;
  aggregateTonnage: (sets: Array<Record<string, unknown>>) => number;
};

// ============================================================================
// EXTERNAL TONNAGE CORRECTNESS TESTS
// ============================================================================

// --- Golden Fixture Tests ---
test('External Tonnage Golden Fixtures', async (t) => {
  for (const fixture of fixtures.fixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const set: Record<string, unknown> = {
        reps: fixture.input.reps,
        weight: fixture.input.weight,
        weightUnit: fixture.input.weightUnit,
        loadType: fixture.input.loadType,
        implementCount: fixture.input.implementCount
      };

      const result = sessionMetrics.computeSetTonnage(set);

      const tolerance = fixture.tolerance ?? 1;
      assert.ok(
        Math.abs(result - fixture.expected) <= tolerance,
        `Expected ${fixture.expected}, got ${result}`
      );
    });
  }
});

// --- Correctness: No Bodyweight Inference ---
test('CORRECTNESS: Push-up with reps only = 0 tonnage (no virtual BW)', () => {
  const set = { reps: 20 }; // No weight entered
  const result = sessionMetrics.computeSetTonnage(set);
  assert.equal(result, 0, 'Bodyweight-only push-up should have 0 external tonnage');
});

test('CORRECTNESS: Pull-up with reps only = 0 tonnage (no virtual BW)', () => {
  const set = { reps: 10 }; // No weight entered
  const result = sessionMetrics.computeSetTonnage(set);
  assert.equal(result, 0, 'Bodyweight-only pull-up should have 0 external tonnage');
});

test('CORRECTNESS: Weighted pull-up uses external weight ONLY', () => {
  const set = { reps: 10, weight: 25, weightUnit: 'lb' };
  const result = sessionMetrics.computeSetTonnage(set);
  assert.equal(result, 250, '10 × 25 = 250 (no virtual bodyweight added)');
});

test('CORRECTNESS: Step-ups bodyweight only = 0 tonnage', () => {
  const set = { reps: 20 }; // No weight entered
  const result = sessionMetrics.computeSetTonnage(set);
  assert.equal(result, 0, 'Step-ups without external weight = 0 tonnage');
});

test('CORRECTNESS: Step-ups with dumbbells = external weight only', () => {
  const set = { reps: 10, weight: 25, weightUnit: 'lb', loadType: 'per_implement', implementCount: 2 };
  const result = sessionMetrics.computeSetTonnage(set);
  assert.equal(result, 500, '10 × (25 × 2) = 500 (external weight only)');
});

test('CORRECTNESS: Bulgarian split squat with dumbbells = external only', () => {
  const set = { reps: 8, weight: 30, weightUnit: 'lb', loadType: 'per_implement', implementCount: 2 };
  const result = sessionMetrics.computeSetTonnage(set);
  assert.equal(result, 480, '8 × (30 × 2) = 480 (no bodyweight added)');
});

// --- Workload Score (Load) Correctness ---
test('CORRECTNESS: Bodyweight-only set with reps = 0 load (no estimation)', () => {
  const set = { reps: 20, rpe: 8 }; // No weight, no duration
  const result = sessionMetrics.computeSetLoad(set);
  assert.equal(result, 0, 'No weight and no duration = 0 load (pure accuracy)');
});

test('CORRECTNESS: Set with external weight computes load correctly', () => {
  const set = { reps: 10, weight: 100, weightUnit: 'lb', rpe: 8 };
  const result = sessionMetrics.computeSetLoad(set);
  // Tonnage = 1000, intensity factor for RPE 8 ≈ 0.67
  assert.ok(result > 0, 'Weighted set should have positive load');
  assert.ok(result < 1000, 'Load should be tonnage × intensity factor (< 1.0)');
});

test('CORRECTNESS: Cardio with explicit duration computes load', () => {
  const set = { durationSeconds: 1800, rpe: 7, metricProfile: 'cardio_session' }; // 30 min
  const result = sessionMetrics.computeSetLoad(set);
  assert.ok(result > 0, 'Cardio with duration should have positive load');
});

test('CORRECTNESS: Cardio without duration = 0 load', () => {
  const set = { reps: 10, rpe: 7, metricProfile: 'cardio_session' }; // No duration
  const result = sessionMetrics.computeSetLoad(set);
  assert.equal(result, 0, 'Cardio without explicit duration = 0 load');
});

// --- Property Tests ---
test('Tonnage Invariant: Always >= 0', () => {
  const testCases = [
    { reps: 10, weight: 100, weightUnit: 'lb' },
    { reps: 0, weight: 100, weightUnit: 'lb' },
    { reps: 10, weight: 0, weightUnit: 'lb' },
    { reps: -5, weight: 100, weightUnit: 'lb' },
    { reps: 10 }, // No weight
  ];

  for (const tc of testCases) {
    const result = sessionMetrics.computeSetTonnage(tc);
    assert.ok(result >= 0, `Tonnage should never be negative: ${result}`);
  }
});

test('Tonnage Invariant: Scales linearly with reps', () => {
  const set1 = { reps: 5, weight: 100, weightUnit: 'lb' };
  const set2 = { reps: 10, weight: 100, weightUnit: 'lb' };

  const tonnage1 = sessionMetrics.computeSetTonnage(set1);
  const tonnage2 = sessionMetrics.computeSetTonnage(set2);

  assert.equal(tonnage2, tonnage1 * 2, 'Double reps = double tonnage');
});

test('Tonnage Invariant: Scales linearly with weight', () => {
  const set1 = { reps: 10, weight: 50, weightUnit: 'lb' };
  const set2 = { reps: 10, weight: 100, weightUnit: 'lb' };

  const tonnage1 = sessionMetrics.computeSetTonnage(set1);
  const tonnage2 = sessionMetrics.computeSetTonnage(set2);

  assert.equal(tonnage2, tonnage1 * 2, 'Double weight = double tonnage');
});

test('Tonnage Invariant: Per-implement multiplies correctly', () => {
  const setTotal = { reps: 10, weight: 80, weightUnit: 'lb', loadType: 'total' };
  const setPerImpl = { reps: 10, weight: 40, weightUnit: 'lb', loadType: 'per_implement', implementCount: 2 };

  const tonnageTotal = sessionMetrics.computeSetTonnage(setTotal);
  const tonnagePerImpl = sessionMetrics.computeSetTonnage(setPerImpl);

  assert.equal(tonnageTotal, tonnagePerImpl, 'Total 80lb = 2x40lb per-implement');
});

// --- Aggregate Tonnage Test ---
test('Aggregate Tonnage: Sums correctly', () => {
  const sets = [
    { reps: 10, weight: 100, weightUnit: 'lb' }, // 1000
    { reps: 8, weight: 120, weightUnit: 'lb' },  // 960
    { reps: 6, weight: 140, weightUnit: 'lb' },  // 840
  ];

  const total = sessionMetrics.aggregateTonnage(sets);
  assert.equal(total, 2800, 'Aggregate should sum all set tonnages');
});

test('Aggregate Tonnage: Empty array returns 0', () => {
  const total = sessionMetrics.aggregateTonnage([]);
  assert.equal(total, 0);
});

test('Aggregate Tonnage: Bodyweight sets contribute 0', () => {
  const sets = [
    { reps: 10, weight: 100, weightUnit: 'lb' }, // 1000
    { reps: 20 }, // 0 (bodyweight, no external weight)
    { reps: 8, weight: 50, weightUnit: 'lb' },   // 400
  ];

  const total = sessionMetrics.aggregateTonnage(sets);
  assert.equal(total, 1400, 'Bodyweight set contributes 0 to aggregate');
});

// --- KG to LBS Conversion ---
test('Tonnage: KG weight converted to LBS in output', () => {
  const set = { reps: 10, weight: 100, weightUnit: 'kg' };
  const result = sessionMetrics.computeSetTonnage(set);
  // 100 kg = 220.462 lbs, × 10 reps = 2204.62 lbs
  assert.ok(Math.abs(result - 2204.62) < 1, `Expected ~2204.62, got ${result}`);
});
