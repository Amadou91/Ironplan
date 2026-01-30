/**
 * Readiness and Intensity Correctness Tests
 * 
 * Tests readiness score calculation and RPE intensity normalization.
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
  readFileSync(join(__dirname, '../fixtures/readiness-fixtures.json'), 'utf8')
);

// Load modules under test
const trainingMetrics = loadTsModule(
  join(__dirname, '../../src/lib/training-metrics.ts')
) as {
  computeReadinessScore: (survey: { sleep: number; soreness: number; stress: number; motivation: number }) => number | null;
  getReadinessLevel: (score: number | null) => 'low' | 'steady' | 'high';
  getReadinessIntensity: (level: 'low' | 'steady' | 'high') => string;
};

const units = loadTsModule(
  join(__dirname, '../../src/lib/units.ts')
) as {
  normalizeIntensity: (rpe: number | null) => number;
};

// --- Readiness Score Golden Tests ---
test('Readiness Score Golden Fixtures', async (t) => {
  for (const fixture of fixtures.readinessFixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const result = trainingMetrics.computeReadinessScore(fixture.input);
      
      assert.notEqual(result, null, 'Score should not be null for valid input');
      assert.equal(result, fixture.expected.score, 
        `Expected score ${fixture.expected.score}, got ${result}`);
    });
  }
});

// --- Readiness Level Classification ---
test('Readiness Level Classification', async (t) => {
  for (const fixture of fixtures.readinessFixtures) {
    await t.test(`Level for ${fixture.id}`, () => {
      const level = trainingMetrics.getReadinessLevel(fixture.expected.score);
      assert.equal(level, fixture.expected.level,
        `Score ${fixture.expected.score} should be ${fixture.expected.level}, got ${level}`);
    });
  }
});

test('Readiness Level: Boundary at 70 (high)', () => {
  assert.equal(trainingMetrics.getReadinessLevel(70), 'high');
  assert.equal(trainingMetrics.getReadinessLevel(69), 'steady');
});

test('Readiness Level: Boundary at 40 (low)', () => {
  assert.equal(trainingMetrics.getReadinessLevel(40), 'steady');
  assert.equal(trainingMetrics.getReadinessLevel(39), 'low');
});

test('Readiness Level: Null returns steady', () => {
  assert.equal(trainingMetrics.getReadinessLevel(null), 'steady');
});

// --- Readiness Intensity Mapping ---
test('Readiness Intensity Mapping', () => {
  assert.equal(trainingMetrics.getReadinessIntensity('low'), 'low');
  assert.equal(trainingMetrics.getReadinessIntensity('steady'), 'moderate');
  assert.equal(trainingMetrics.getReadinessIntensity('high'), 'high');
});

// --- Readiness Property Tests ---
test('Readiness Invariant: Score always 0-100', () => {
  const testCases = [
    { sleep: 5, soreness: 1, stress: 1, motivation: 5 }, // Max
    { sleep: 1, soreness: 5, stress: 5, motivation: 1 }, // Min
    { sleep: 3, soreness: 3, stress: 3, motivation: 3 }, // Mid
    { sleep: 5, soreness: 5, stress: 5, motivation: 5 }, // All 5s
    { sleep: 1, soreness: 1, stress: 1, motivation: 1 }, // All 1s
  ];

  for (const tc of testCases) {
    const result = trainingMetrics.computeReadinessScore(tc);
    assert.ok(result !== null);
    assert.ok(result >= 0 && result <= 100, 
      `Score ${result} should be 0-100 for input ${JSON.stringify(tc)}`);
  }
});

test('Readiness Invariant: Higher sleep = higher score (other factors equal)', () => {
  const base = { soreness: 3, stress: 3, motivation: 3 };
  
  const score1 = trainingMetrics.computeReadinessScore({ ...base, sleep: 1 });
  const score3 = trainingMetrics.computeReadinessScore({ ...base, sleep: 3 });
  const score5 = trainingMetrics.computeReadinessScore({ ...base, sleep: 5 });
  
  assert.ok(score1! < score3!, 'Better sleep = higher score');
  assert.ok(score3! < score5!, 'Better sleep = higher score');
});

test('Readiness Invariant: Higher soreness = LOWER score', () => {
  const base = { sleep: 3, stress: 3, motivation: 3 };
  
  const score1 = trainingMetrics.computeReadinessScore({ ...base, soreness: 1 });
  const score3 = trainingMetrics.computeReadinessScore({ ...base, soreness: 3 });
  const score5 = trainingMetrics.computeReadinessScore({ ...base, soreness: 5 });
  
  assert.ok(score1! > score3!, 'Higher soreness = lower score (inverted)');
  assert.ok(score3! > score5!, 'Higher soreness = lower score (inverted)');
});

test('Readiness Invariant: Higher stress = LOWER score', () => {
  const base = { sleep: 3, soreness: 3, motivation: 3 };
  
  const score1 = trainingMetrics.computeReadinessScore({ ...base, stress: 1 });
  const score3 = trainingMetrics.computeReadinessScore({ ...base, stress: 3 });
  const score5 = trainingMetrics.computeReadinessScore({ ...base, stress: 5 });
  
  assert.ok(score1! > score3!, 'Higher stress = lower score (inverted)');
  assert.ok(score3! > score5!, 'Higher stress = lower score (inverted)');
});

// --- Intensity Normalization Golden Tests ---
test('Intensity Normalization Golden Fixtures', async (t) => {
  for (const fixture of fixtures.intensityFixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const result = units.normalizeIntensity(fixture.input.rpe);
      const tolerance = fixture.tolerance ?? 0.001;
      
      assert.ok(
        Math.abs(result - fixture.expected) <= tolerance,
        `Expected ${fixture.expected}, got ${result}`
      );
    });
  }
});

// --- Intensity Normalization Property Tests ---
test('Intensity Invariant: Always 0-1 range', () => {
  const testRpes = [-5, 0, 2, 4, 5, 7, 10, 12, 100];
  
  for (const rpe of testRpes) {
    const result = units.normalizeIntensity(rpe);
    assert.ok(result >= 0 && result <= 1, 
      `Intensity ${result} should be 0-1 for RPE ${rpe}`);
  }
});

test('Intensity Invariant: Monotonically increasing', () => {
  const rpes = [4, 5, 6, 7, 8, 9, 10];
  const intensities = rpes.map(rpe => units.normalizeIntensity(rpe));
  
  for (let i = 0; i < intensities.length - 1; i++) {
    assert.ok(intensities[i] <= intensities[i + 1], 
      `Intensity should increase: RPE ${rpes[i]}=${intensities[i]}, RPE ${rpes[i+1]}=${intensities[i+1]}`);
  }
});

test('Intensity Invariant: RPE 10 = max (1.0)', () => {
  assert.equal(units.normalizeIntensity(10), 1.0);
});

test('Intensity Invariant: Null returns default 0.5', () => {
  assert.equal(units.normalizeIntensity(null), 0.5);
});

test('Intensity Invariant: Sub-threshold returns minimum', () => {
  assert.equal(units.normalizeIntensity(0), 0.1);
  assert.equal(units.normalizeIntensity(1), 0.1);
  assert.equal(units.normalizeIntensity(2), 0.1);
  assert.equal(units.normalizeIntensity(3), 0.1);
});
