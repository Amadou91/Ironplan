/**
 * Math Utilities Correctness Tests
 * 
 * Tests core mathematical utilities: clamp, weightedAverage, roundTo, isValidNumber.
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
  readFileSync(join(__dirname, '../fixtures/math-fixtures.json'), 'utf8')
);

// Load module under test
const math = loadTsModule(
  join(__dirname, '../../src/lib/math.ts')
) as {
  clamp: (value: number, min: number, max: number) => number;
  weightedAverage: (values: Array<number | null>, weights: number[]) => number | null;
  roundTo: (value: number, decimals?: number) => number;
  isValidNumber: (value: unknown) => boolean;
};

// --- Clamp Golden Tests ---
test('Clamp Golden Fixtures', async (t) => {
  for (const fixture of fixtures.clampFixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const { value, min, max } = fixture.input;
      const result = math.clamp(value, min, max);
      assert.equal(result, fixture.expected);
    });
  }
});

// --- Clamp Property Tests ---
test('Clamp Invariant: Result always within bounds', () => {
  const testCases = [
    { value: -1000, min: 0, max: 10 },
    { value: 1000, min: 0, max: 10 },
    { value: 5, min: 0, max: 10 },
    { value: -50, min: -100, max: -10 },
  ];

  for (const tc of testCases) {
    const result = math.clamp(tc.value, tc.min, tc.max);
    assert.ok(result >= tc.min, `Result ${result} >= min ${tc.min}`);
    assert.ok(result <= tc.max, `Result ${result} <= max ${tc.max}`);
  }
});

test('Clamp Invariant: Idempotent for in-range values', () => {
  // clamp(clamp(x)) = clamp(x) for any x
  const value = 5;
  const result1 = math.clamp(value, 0, 10);
  const result2 = math.clamp(result1, 0, 10);
  assert.equal(result1, result2);
});

test('Clamp Invariant: Order preserved for ordered inputs', () => {
  const min = 0;
  const max = 10;
  const values = [-5, 0, 3, 7, 10, 15];
  const clamped = values.map(v => math.clamp(v, min, max));
  
  // After clamping, relative order should be non-decreasing
  for (let i = 0; i < clamped.length - 1; i++) {
    assert.ok(clamped[i] <= clamped[i + 1], 
      `Order should be preserved: ${clamped[i]} <= ${clamped[i+1]}`);
  }
});

// --- Weighted Average Golden Tests ---
test('Weighted Average Golden Fixtures', async (t) => {
  for (const fixture of fixtures.weightedAverageFixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const result = math.weightedAverage(fixture.input.values, fixture.input.weights);
      
      if (fixture.expected === null) {
        assert.equal(result, null);
      } else {
        const tolerance = fixture.tolerance ?? 0.01;
        assert.ok(
          Math.abs(result! - fixture.expected) <= tolerance,
          `Expected ${fixture.expected}, got ${result}`
        );
      }
    });
  }
});

// --- Weighted Average Property Tests ---
test('Weighted Average Invariant: Equal weights = arithmetic mean', () => {
  const values = [10, 20, 30];
  const weights = [1, 1, 1];
  
  const result = math.weightedAverage(values, weights);
  const arithmeticMean = (10 + 20 + 30) / 3;
  
  assert.ok(
    Math.abs(result! - arithmeticMean) < 0.001,
    `Equal weights should produce arithmetic mean: ${result} vs ${arithmeticMean}`
  );
});

test('Weighted Average Invariant: Result within value bounds', () => {
  const values = [10, 20, 30, 40, 50];
  const weights = [1, 2, 3, 2, 1];
  
  const result = math.weightedAverage(values, weights);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  
  assert.ok(result! >= minVal && result! <= maxVal,
    `Result ${result} should be within [${minVal}, ${maxVal}]`);
});

test('Weighted Average Invariant: Higher weight pulls average', () => {
  const values = [10, 100];
  
  const resultEqualWeight = math.weightedAverage(values, [1, 1]);
  const resultHighFirst = math.weightedAverage(values, [10, 1]);
  const resultHighSecond = math.weightedAverage(values, [1, 10]);
  
  // With equal weights: 55
  // With high weight on first (10): closer to 10
  // With high weight on second (100): closer to 100
  assert.ok(resultHighFirst! < resultEqualWeight!, 
    'Higher weight on smaller value pulls average down');
  assert.ok(resultHighSecond! > resultEqualWeight!, 
    'Higher weight on larger value pulls average up');
});

// --- RoundTo Golden Tests ---
test('RoundTo Golden Fixtures', async (t) => {
  for (const fixture of fixtures.roundToFixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const result = math.roundTo(fixture.input.value, fixture.input.decimals);
      assert.equal(result, fixture.expected);
    });
  }
});

// --- RoundTo Property Tests ---
test('RoundTo Invariant: Idempotent', () => {
  const value = 3.14159;
  const decimals = 2;
  
  const result1 = math.roundTo(value, decimals);
  const result2 = math.roundTo(result1, decimals);
  
  assert.equal(result1, result2, 'RoundTo should be idempotent');
});

test('RoundTo Invariant: Default is 2 decimals', () => {
  const value = 3.14159;
  const resultDefault = math.roundTo(value);
  const resultExplicit = math.roundTo(value, 2);
  
  assert.equal(resultDefault, resultExplicit);
});

// --- isValidNumber Golden Tests ---
test('isValidNumber Golden Fixtures', async (t) => {
  for (const fixture of fixtures.isValidNumberFixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      let input = fixture.input;
      
      // Handle special string representations
      if (input === 'NaN') input = NaN;
      else if (input === 'Infinity') input = Infinity;
      else if (input === 'undefined') input = undefined;
      
      const result = math.isValidNumber(input);
      assert.equal(result, fixture.expected);
    });
  }
});

// --- isValidNumber Property Tests ---
test('isValidNumber: Type guard behavior', () => {
  // Valid numbers
  assert.equal(math.isValidNumber(0), true);
  assert.equal(math.isValidNumber(1), true);
  assert.equal(math.isValidNumber(-1), true);
  assert.equal(math.isValidNumber(3.14), true);
  assert.equal(math.isValidNumber(-3.14), true);
  
  // Invalid - special values
  assert.equal(math.isValidNumber(NaN), false);
  assert.equal(math.isValidNumber(Infinity), false);
  assert.equal(math.isValidNumber(-Infinity), false);
  
  // Invalid - not numbers
  assert.equal(math.isValidNumber(null), false);
  assert.equal(math.isValidNumber(undefined), false);
  assert.equal(math.isValidNumber('42'), false);
  assert.equal(math.isValidNumber([42]), false);
  assert.equal(math.isValidNumber({ value: 42 }), false);
});
