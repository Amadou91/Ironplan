/**
 * Body Metrics Correctness Tests
 * 
 * Tests BMI, BMR, and age calculations.
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
  readFileSync(join(__dirname, '../fixtures/body-metrics-fixtures.json'), 'utf8')
);

// Load module under test
const bodyMetrics = loadTsModule(
  join(__dirname, '../../src/lib/body-metrics.ts')
) as {
  calculateBmi: (weightLb?: number | null, heightIn?: number | null) => number | null;
  calculateBmr: (weightLb?: number | null, heightIn?: number | null, age?: number | null, sex?: string | null) => number | null;
  calculateAge: (birthdate?: string | null) => number | null;
  formatHeightFromInches: (heightIn?: number | null) => string;
};

// --- BMI Golden Tests ---
test('BMI Golden Fixtures', async (t) => {
  for (const fixture of fixtures.bmiFixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const result = bodyMetrics.calculateBmi(fixture.input.weightLb, fixture.input.heightIn);
      
      if (fixture.expected === null) {
        assert.equal(result, null, 'Expected null');
      } else {
        assert.notEqual(result, null);
        const tolerance = fixture.tolerance ?? 0.01;
        assert.ok(
          Math.abs(result! - fixture.expected) <= tolerance,
          `Expected ${fixture.expected}, got ${result}`
        );
      }
    });
  }
});

// --- BMI Property Tests ---
test('BMI Invariant: Always positive for valid inputs', () => {
  const testCases = [
    { weight: 100, height: 60 },
    { weight: 200, height: 72 },
    { weight: 300, height: 66 },
  ];

  for (const tc of testCases) {
    const result = bodyMetrics.calculateBmi(tc.weight, tc.height);
    assert.ok(result !== null && result > 0, `BMI should be positive for weight ${tc.weight}, height ${tc.height}`);
  }
});

test('BMI Invariant: Higher weight = higher BMI (same height)', () => {
  const height = 70;
  const bmi150 = bodyMetrics.calculateBmi(150, height);
  const bmi200 = bodyMetrics.calculateBmi(200, height);
  const bmi250 = bodyMetrics.calculateBmi(250, height);
  
  assert.ok(bmi150! < bmi200!, 'Higher weight = higher BMI');
  assert.ok(bmi200! < bmi250!, 'Higher weight = higher BMI');
});

test('BMI Invariant: Higher height = lower BMI (same weight)', () => {
  const weight = 180;
  const bmi64 = bodyMetrics.calculateBmi(weight, 64);
  const bmi70 = bodyMetrics.calculateBmi(weight, 70);
  const bmi76 = bodyMetrics.calculateBmi(weight, 76);
  
  assert.ok(bmi64! > bmi70!, 'Taller = lower BMI at same weight');
  assert.ok(bmi70! > bmi76!, 'Taller = lower BMI at same weight');
});

test('BMI Formula: Uses 703 conversion factor', () => {
  // BMI = (weight / height²) * 703
  const weight = 180;
  const height = 70;
  const expected = (weight / (height * height)) * 703;
  const result = bodyMetrics.calculateBmi(weight, height);
  
  assert.ok(
    Math.abs(result! - expected) < 0.001,
    `Formula should use 703 factor: expected ${expected}, got ${result}`
  );
});

// --- BMR Golden Tests ---
test('BMR Golden Fixtures', async (t) => {
  for (const fixture of fixtures.bmrFixtures) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const result = bodyMetrics.calculateBmr(
        fixture.input.weightLb,
        fixture.input.heightIn,
        fixture.input.age,
        fixture.input.sex
      );
      
      if (fixture.expected === null) {
        assert.equal(result, null, 'Expected null');
      } else {
        assert.notEqual(result, null);
        const tolerance = fixture.tolerance ?? 10; // BMR can have rounding variance
        assert.ok(
          Math.abs(result! - fixture.expected) <= tolerance,
          `Expected ~${fixture.expected}, got ${result}`
        );
      }
    });
  }
});

// --- BMR Property Tests ---
test('BMR Invariant: Males > Females (same stats)', () => {
  const maleBmr = bodyMetrics.calculateBmr(180, 70, 30, 'male');
  const femaleBmr = bodyMetrics.calculateBmr(180, 70, 30, 'female');
  
  assert.ok(maleBmr! > femaleBmr!, 'Males should have higher BMR than females');
  // The difference should be exactly 166 (5 + 161)
  assert.ok(
    Math.abs((maleBmr! - femaleBmr!) - 166) < 1,
    'Male-female BMR difference should be ~166'
  );
});

test('BMR Invariant: Higher weight = higher BMR', () => {
  const bmr160 = bodyMetrics.calculateBmr(160, 70, 30, 'male');
  const bmr200 = bodyMetrics.calculateBmr(200, 70, 30, 'male');
  
  assert.ok(bmr160! < bmr200!, 'Higher weight = higher BMR');
});

test('BMR Invariant: Older age = lower BMR', () => {
  const bmr20 = bodyMetrics.calculateBmr(180, 70, 20, 'male');
  const bmr40 = bodyMetrics.calculateBmr(180, 70, 40, 'male');
  const bmr60 = bodyMetrics.calculateBmr(180, 70, 60, 'male');
  
  assert.ok(bmr20! > bmr40!, 'Older = lower BMR');
  assert.ok(bmr40! > bmr60!, 'Older = lower BMR');
});

test('BMR Invariant: Invalid sex returns null', () => {
  assert.equal(bodyMetrics.calculateBmr(180, 70, 30, 'other'), null);
  assert.equal(bodyMetrics.calculateBmr(180, 70, 30, 'unknown'), null);
  assert.equal(bodyMetrics.calculateBmr(180, 70, 30, null), null);
  assert.equal(bodyMetrics.calculateBmr(180, 70, 30, ''), null);
});

// --- Age Calculation Tests ---
test('Age Calculation: Simple cases', () => {
  // These tests use a fixed "now" date concept
  // The function uses the current date, so we test relative behavior
  const age = bodyMetrics.calculateAge('1990-01-15');
  assert.ok(age !== null && age >= 35 && age <= 40, `Age should be reasonable: ${age}`);
});

test('Age Calculation: Edge cases', () => {
  assert.equal(bodyMetrics.calculateAge(null), null);
  assert.equal(bodyMetrics.calculateAge(undefined), null);
  assert.equal(bodyMetrics.calculateAge('invalid-date'), null);
  assert.equal(bodyMetrics.calculateAge(''), null);
});

test('Age Calculation: Consistency', () => {
  // Two dates 10 years apart should produce ages 10 years apart
  const age1990 = bodyMetrics.calculateAge('1990-01-01');
  const age2000 = bodyMetrics.calculateAge('2000-01-01');
  
  if (age1990 !== null && age2000 !== null) {
    assert.equal(age1990 - age2000, 10, '10 year difference in birthdate = 10 year age difference');
  }
});

// --- Height Formatting Tests ---
test('Height Formatting: Standard heights', () => {
  assert.equal(bodyMetrics.formatHeightFromInches(72), "6' 0\"");
  assert.equal(bodyMetrics.formatHeightFromInches(70), "5' 10\"");
  assert.equal(bodyMetrics.formatHeightFromInches(64), "5' 4\"");
  assert.equal(bodyMetrics.formatHeightFromInches(60), "5' 0\"");
});

test('Height Formatting: Edge cases', () => {
  assert.equal(bodyMetrics.formatHeightFromInches(null), '');
  assert.equal(bodyMetrics.formatHeightFromInches(undefined), '');
  assert.equal(bodyMetrics.formatHeightFromInches(0), '');
  assert.equal(bodyMetrics.formatHeightFromInches(-5), '');
});

test('Height Formatting: Small heights (inches only)', () => {
  assert.equal(bodyMetrics.formatHeightFromInches(10), '10 in');
  assert.equal(bodyMetrics.formatHeightFromInches(11), '11 in');
});
