/**
 * Tonnage (Volume Load) Correctness Tests
 * 
 * Tests the volume load calculation: reps * weight (lbs)
 * With virtual bodyweight handling for bodyweight exercises.
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
  computeSetTonnage: (
    set: Record<string, unknown>,
    userWeightLbs?: number,
    exerciseName?: string | null,
    isBodyweightExercise?: boolean
  ) => number;
  getBodyweightExerciseType: (exerciseName?: string | null) => 'push' | 'pull' | 'default';
  getVirtualBodyweight: (userWeightLbs: number, exerciseName?: string | null) => number;
  aggregateTonnage: (sets: Array<Record<string, unknown>>) => number;
};

const constants = loadTsModule(
  join(__dirname, '../../src/constants/training.ts')
) as {
  VIRTUAL_WEIGHT_MULTIPLIERS: { push: number; pull: number; default: number };
  DEFAULT_USER_WEIGHT_LB: number;
};

// --- Constants Verification ---
test('Tonnage Constants: Correct values', () => {
  assert.equal(constants.VIRTUAL_WEIGHT_MULTIPLIERS.push, 0.66);
  assert.equal(constants.VIRTUAL_WEIGHT_MULTIPLIERS.pull, 0.90);
  assert.equal(constants.VIRTUAL_WEIGHT_MULTIPLIERS.default, 0.70);
  assert.equal(constants.DEFAULT_USER_WEIGHT_LB, 170);
});

// --- Bodyweight Exercise Type Detection ---
test('Bodyweight Exercise Type Detection', async (t) => {
  await t.test('Push exercises detected correctly', () => {
    assert.equal(sessionMetrics.getBodyweightExerciseType('Push-up'), 'push');
    assert.equal(sessionMetrics.getBodyweightExerciseType('pushup'), 'push');
    assert.equal(sessionMetrics.getBodyweightExerciseType('Dip'), 'push');
    assert.equal(sessionMetrics.getBodyweightExerciseType('Pike Press'), 'push');
  });

  await t.test('Pull exercises detected correctly', () => {
    assert.equal(sessionMetrics.getBodyweightExerciseType('Pull-up'), 'pull');
    assert.equal(sessionMetrics.getBodyweightExerciseType('pullup'), 'pull');
    assert.equal(sessionMetrics.getBodyweightExerciseType('Chin-up'), 'pull');
    assert.equal(sessionMetrics.getBodyweightExerciseType('chinup'), 'pull');
    assert.equal(sessionMetrics.getBodyweightExerciseType('Muscle-up'), 'pull');
  });

  await t.test('Default for unrecognized exercises', () => {
    assert.equal(sessionMetrics.getBodyweightExerciseType('Burpee'), 'default');
    assert.equal(sessionMetrics.getBodyweightExerciseType('Squat'), 'default');
    assert.equal(sessionMetrics.getBodyweightExerciseType(null), 'default');
    assert.equal(sessionMetrics.getBodyweightExerciseType(undefined), 'default');
  });
});

// --- Virtual Bodyweight Calculation ---
test('Virtual Bodyweight Calculation', async (t) => {
  const userWeight = 170;
  
  await t.test('Push exercise virtual weight', () => {
    const result = sessionMetrics.getVirtualBodyweight(userWeight, 'Push-up');
    assert.equal(result, 170 * 0.66, 'Push-up: 66% of bodyweight');
  });

  await t.test('Pull exercise virtual weight', () => {
    const result = sessionMetrics.getVirtualBodyweight(userWeight, 'Pull-up');
    assert.equal(result, 170 * 0.90, 'Pull-up: 90% of bodyweight');
  });

  await t.test('Default exercise virtual weight', () => {
    const result = sessionMetrics.getVirtualBodyweight(userWeight, 'Burpee');
    assert.equal(result, 170 * 0.70, 'Default: 70% of bodyweight');
  });
});

// --- Tonnage Golden Fixture Tests ---
test('Tonnage Golden Fixtures', async (t) => {
  for (const fixture of fixtures.fixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const set: Record<string, unknown> = {
        reps: fixture.input.reps,
        weight: fixture.input.weight,
        weightUnit: fixture.input.weightUnit,
        loadType: fixture.input.loadType,
        implementCount: fixture.input.implementCount
      };

      const result = sessionMetrics.computeSetTonnage(
        set,
        fixture.input.userWeightLbs,
        fixture.input.exerciseName
      );

      const tolerance = fixture.tolerance ?? 1; // Allow 1 lb tolerance
      assert.ok(
        Math.abs(result - fixture.expected) <= tolerance,
        `Expected ${fixture.expected}, got ${result}`
      );
    });
  }
});

// --- Property Tests ---
test('Tonnage Invariant: Always >= 0', () => {
  const testCases = [
    { reps: 10, weight: 100, weightUnit: 'lb' },
    { reps: 0, weight: 100, weightUnit: 'lb' },
    { reps: 10, weight: 0, weightUnit: 'lb' },
    { reps: -5, weight: 100, weightUnit: 'lb' }, // Negative reps should return 0
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

// --- Bodyweight + External Weight ---
test('Weighted Bodyweight: Adds external weight to virtual', () => {
  const userWeight = 170;
  const externalWeight = 45;
  
  // Pull-up virtual weight: 170 * 0.90 = 153
  // Total: 153 + 45 = 198
  // Tonnage: 10 * 198 = 1980
  
  const set = {
    reps: 10,
    weight: externalWeight,
    weightUnit: 'lb'
  };
  
  const result = sessionMetrics.computeSetTonnage(set, userWeight, 'Weighted Pull-up', true);
  
  // Virtual (153) + External (45) = 198 per rep
  const expected = 10 * (153 + 45);
  assert.ok(
    Math.abs(result - expected) <= 1,
    `Expected ~${expected}, got ${result}`
  );
});

// --- Unit Conversion in Tonnage ---
test('Tonnage: KG weight converted to LBS in output', () => {
  const setKg = { reps: 10, weight: 100, weightUnit: 'kg' };
  const setLb = { reps: 10, weight: 220.46, weightUnit: 'lb' };

  const tonnageKg = sessionMetrics.computeSetTonnage(setKg);
  const tonnageLb = sessionMetrics.computeSetTonnage(setLb);

  // Both should produce similar tonnage (all in lbs)
  assert.ok(
    Math.abs(tonnageKg - tonnageLb) < 5,
    `KG set tonnage (${tonnageKg}) should match LB equivalent (${tonnageLb})`
  );
});
