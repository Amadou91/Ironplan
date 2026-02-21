/**
 * E1RM Correctness Tests
 * 
 * Tests the Estimated 1-Rep Max calculation using the Epley formula.
 * Formula: weight * (1 + repsAtFailure / 30) where repsAtFailure = reps + RIR
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
  readFileSync(join(__dirname, '../fixtures/e1rm-fixtures.json'), 'utf8')
);

// Load module under test
const sessionMetrics = loadTsModule(
  join(__dirname, '../../src/lib/session-metrics.ts')
) as {
  computeSetE1rm: (set: Record<string, unknown>, goal?: string | null, eligible?: boolean | null) => number | null;
  isSetE1rmEligible: (goal?: string | null, exerciseEligible?: boolean | null, set?: Record<string, unknown>) => boolean;
  mapRirToRpe: (rir: number) => number | null;
  mapRpeToRir: (rpe: number) => number | null;
};

// --- Golden Fixture Tests ---
test('E1RM Golden Fixtures', async (t) => {
  for (const fixture of fixtures.fixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const set = {
        reps: fixture.input.reps,
        weight: fixture.input.weight,
        weightUnit: fixture.input.weightUnit,
        rpe: fixture.input.rpe ?? undefined,
        rir: fixture.input.rir ?? undefined,
        loadType: fixture.input.loadType,
        implementCount: fixture.input.implementCount
      };

      const result = sessionMetrics.computeSetE1rm(set, null, true);
      
      assert.notEqual(result, null, 'E1RM should not be null for eligible set');
      const tolerance = fixture.expected.tolerance ?? 0.01;
      assert.ok(
        Math.abs(result! - fixture.expected.e1rm) <= tolerance * fixture.expected.e1rm,
        `E1RM ${result} should be within ${tolerance * 100}% of ${fixture.expected.e1rm}`
      );
    });
  }
});

// --- Ineligible Case Tests ---
test('E1RM Ineligible Cases', async (t) => {
  for (const fixture of fixtures.ineligibleCases) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const set = {
        reps: fixture.input.reps,
        weight: fixture.input.weight,
        weightUnit: fixture.input.weightUnit,
        rpe: fixture.input.rpe,
        rir: fixture.input.rir
      };

      const eligible = sessionMetrics.isSetE1rmEligible(null, true, set);
      assert.equal(eligible, false, `Set should be ineligible: ${fixture.reason}`);
      
      const result = sessionMetrics.computeSetE1rm(set, null, true);
      assert.equal(result, null, 'E1RM should be null for ineligible set');
    });
  }
});

// --- Property/Invariant Tests ---
test('E1RM Invariant: Monotonicity with weight', () => {
  // Higher weight at same reps/effort should yield higher E1RM
  const baseSet = { reps: 5, rpe: 8, weightUnit: 'kg' };
  
  const e1rm50 = sessionMetrics.computeSetE1rm({ ...baseSet, weight: 50 }, null, true);
  const e1rm100 = sessionMetrics.computeSetE1rm({ ...baseSet, weight: 100 }, null, true);
  const e1rm150 = sessionMetrics.computeSetE1rm({ ...baseSet, weight: 150 }, null, true);
  
  assert.ok(e1rm50! < e1rm100!, 'E1RM should increase with weight');
  assert.ok(e1rm100! < e1rm150!, 'E1RM should increase with weight');
});

test('E1RM Invariant: Monotonicity with reps (at same weight)', () => {
  // More reps at same weight should yield higher E1RM (you're stronger)
  const baseSet = { weight: 100, weightUnit: 'kg', rpe: 10 };
  
  const e1rm3 = sessionMetrics.computeSetE1rm({ ...baseSet, reps: 3 }, null, true);
  const e1rm6 = sessionMetrics.computeSetE1rm({ ...baseSet, reps: 6 }, null, true);
  const e1rm10 = sessionMetrics.computeSetE1rm({ ...baseSet, reps: 10 }, null, true);
  
  assert.ok(e1rm3! < e1rm6!, 'More reps at same weight = higher E1RM');
  assert.ok(e1rm6! < e1rm10!, 'More reps at same weight = higher E1RM');
});

test('E1RM Invariant: E1RM >= actual weight used', () => {
  // The estimated 1RM should always be >= the weight used in the set
  const testCases = [
    { weight: 100, reps: 5, rpe: 8 },
    { weight: 150, reps: 3, rpe: 9 },
    { weight: 60, reps: 10, rpe: 7 }
  ];
  
  for (const tc of testCases) {
    const set = { ...tc, weightUnit: 'kg' };
    const e1rm = sessionMetrics.computeSetE1rm(set, null, true);
    assert.ok(e1rm! >= tc.weight, `E1RM (${e1rm}) should be >= weight used (${tc.weight})`);
  }
});

test('E1RM Invariant: Single rep at RPE 10 equals weight', () => {
  // At 1 rep, RPE 10 (RIR 0), E1RM should be very close to weight
  const set = { weight: 200, reps: 1, rpe: 10, weightUnit: 'kg' };
  const e1rm = sessionMetrics.computeSetE1rm(set, null, true);
  
  // Formula: 200 * (1 + 1/30) = 206.67 (slightly higher due to formula)
  // This is expected - Epley formula always overestimates at 1 rep
  assert.ok(e1rm! >= 200 && e1rm! <= 210, 
    `1RM at RPE 10 should be close to weight: ${e1rm}`);
});

test('E1RM Invariant: RIR above cap is ineligible', () => {
  const ineligibleSet = { weight: 100, reps: 5, rir: 4, weightUnit: 'kg' };
  const eligibleSet = { weight: 100, reps: 5, rir: 3, weightUnit: 'kg' };

  const ineligible = sessionMetrics.computeSetE1rm(ineligibleSet, null, true);
  const eligible = sessionMetrics.computeSetE1rm(eligibleSet, null, true);

  assert.equal(ineligible, null, 'RIR > 3 should be ineligible');
  assert.notEqual(eligible, null, 'RIR <= 3 should remain eligible');
});

// --- RIR/RPE Mapping Tests ---
test('RIR/RPE Mapping: Round-trip consistency', () => {
  // mapRirToRpe(mapRpeToRir(x)) should equal x for valid values
  for (let rpe = 5; rpe <= 10; rpe++) {
    const rir = sessionMetrics.mapRpeToRir(rpe);
    if (rir !== null) {
      const backToRpe = sessionMetrics.mapRirToRpe(rir);
      assert.equal(backToRpe, rpe, `Round-trip RPE ${rpe} -> RIR ${rir} -> RPE ${backToRpe}`);
    }
  }
});

test('RIR/RPE Mapping: Known values', () => {
  assert.equal(sessionMetrics.mapRirToRpe(0), 10, 'RIR 0 = RPE 10');
  assert.equal(sessionMetrics.mapRirToRpe(2), 8, 'RIR 2 = RPE 8');
  assert.equal(sessionMetrics.mapRirToRpe(4), 6, 'RIR 4 = RPE 6');
  
  assert.equal(sessionMetrics.mapRpeToRir(10), 0, 'RPE 10 = RIR 0');
  assert.equal(sessionMetrics.mapRpeToRir(8), 2, 'RPE 8 = RIR 2');
  assert.equal(sessionMetrics.mapRpeToRir(6), 4, 'RPE 6 = RIR 4');
});

test('RIR/RPE Mapping: Edge cases', () => {
  assert.equal(sessionMetrics.mapRirToRpe(Infinity), null, 'Infinity RIR returns null');
  assert.equal(sessionMetrics.mapRirToRpe(NaN), null, 'NaN RIR returns null');
  assert.equal(sessionMetrics.mapRpeToRir(4), null, 'RPE < 5 returns null');
});
