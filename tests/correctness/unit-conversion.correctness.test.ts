/**
 * Unit Conversion Correctness Tests
 * 
 * Tests weight (kg/lb) and distance (m/km/miles) conversions.
 * Critical for all load-based metrics to be accurate.
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
  readFileSync(join(__dirname, '../fixtures/unit-conversion-fixtures.json'), 'utf8')
);

// Load module under test
const units = loadTsModule(
  join(__dirname, '../../src/lib/units.ts')
) as {
  toKg: (value: number, unit: string | null | undefined) => number;
  toLbs: (value: number, unit: string | null | undefined) => number;
  convertWeight: (value: number, fromUnit: string, toUnit: string) => number;
  toMeters: (value: number, unit: string) => number;
  normalizeIntensity: (rpe: number | null) => number;
  LBS_PER_KG: number;
  KG_PER_LB: number;
  METERS_PER_MILE: number;
  METERS_PER_KM: number;
};

// --- Constant Verification ---
test('Unit Constants: Correct values', () => {
  assert.ok(
    Math.abs(units.LBS_PER_KG - 2.20462262) < 0.0000001,
    'LBS_PER_KG should be 2.20462262'
  );
  assert.ok(
    Math.abs(units.KG_PER_LB - 0.45359237) < 0.0000001,
    'KG_PER_LB should be 1/LBS_PER_KG'
  );
  assert.equal(units.METERS_PER_MILE, 1609.344, 'METERS_PER_MILE should be 1609.344');
  assert.equal(units.METERS_PER_KM, 1000, 'METERS_PER_KM should be 1000');
});

test('Unit Constants: Inverse relationship', () => {
  // LBS_PER_KG * KG_PER_LB should equal 1
  const product = units.LBS_PER_KG * units.KG_PER_LB;
  assert.ok(
    Math.abs(product - 1) < 0.0000001,
    `LBS_PER_KG * KG_PER_LB should equal 1, got ${product}`
  );
});

// --- Weight Conversion Golden Tests ---
test('Weight Conversion Golden Fixtures', async (t) => {
  for (const fixture of fixtures.weightConversions) {
    // Skip round-trip tests (handled separately)
    if (fixture.input.roundTrip) continue;
    
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const { value, fromUnit, toUnit } = fixture.input;
      
      let result: number;
      if (fromUnit === null || fromUnit === undefined) {
        // Test toKg with null unit
        result = units.toKg(value, fromUnit);
      } else {
        result = units.convertWeight(value, fromUnit, toUnit);
      }
      
      const tolerance = fixture.tolerance ?? 0.0001;
      assert.ok(
        Math.abs(result - fixture.expected) <= tolerance,
        `Expected ${fixture.expected}, got ${result}`
      );
    });
  }
});

// --- Round-trip Tests ---
test('Weight Conversion: Round-trip kg -> lb -> kg', () => {
  const original = 100;
  const toLb = units.convertWeight(original, 'kg', 'lb');
  const backToKg = units.convertWeight(toLb, 'lb', 'kg');
  
  assert.ok(
    Math.abs(backToKg - original) < 0.0001,
    `Round-trip should preserve value: ${original} -> ${toLb} -> ${backToKg}`
  );
});

test('Weight Conversion: Round-trip lb -> kg -> lb', () => {
  const original = 225;
  const toKg = units.convertWeight(original, 'lb', 'kg');
  const backToLb = units.convertWeight(toKg, 'kg', 'lb');
  
  assert.ok(
    Math.abs(backToLb - original) < 0.0001,
    `Round-trip should preserve value: ${original} -> ${toKg} -> ${backToLb}`
  );
});

// --- Distance Conversion Tests ---
test('Distance Conversion Golden Fixtures', async (t) => {
  for (const fixture of fixtures.distanceConversions) {
    await t.test(`${fixture.id}: ${fixture.description}`, () => {
      const result = units.toMeters(fixture.input.value, fixture.input.unit);
      const tolerance = fixture.tolerance ?? 0.001;
      
      assert.ok(
        Math.abs(result - fixture.expected) <= tolerance,
        `Expected ${fixture.expected}, got ${result}`
      );
    });
  }
});

// --- Edge Case Tests ---
test('Weight Conversion Edge Cases', async (t) => {
  await t.test('NaN input returns 0', () => {
    assert.equal(units.toKg(NaN, 'lb'), 0);
    assert.equal(units.toLbs(NaN, 'kg'), 0);
    assert.equal(units.convertWeight(NaN, 'kg', 'lb'), 0);
  });

  await t.test('Infinity input returns 0', () => {
    assert.equal(units.toKg(Infinity, 'lb'), 0);
    assert.equal(units.toLbs(Infinity, 'kg'), 0);
    assert.equal(units.convertWeight(Infinity, 'kg', 'lb'), 0);
  });

  await t.test('Negative Infinity input returns 0', () => {
    assert.equal(units.toKg(-Infinity, 'lb'), 0);
  });
});

// --- Property Tests: toKg/toLbs consistency ---
test('Weight Conversion: toKg and convertWeight consistency', () => {
  const testValues = [0, 50, 100, 225, 500];
  
  for (const value of testValues) {
    const viaToKg = units.toKg(value, 'lb');
    const viaConvert = units.convertWeight(value, 'lb', 'kg');
    
    assert.ok(
      Math.abs(viaToKg - viaConvert) < 0.0001,
      `toKg(${value}, 'lb') should equal convertWeight(${value}, 'lb', 'kg')`
    );
  }
});

test('Weight Conversion: toLbs and convertWeight consistency', () => {
  const testValues = [0, 50, 100, 200];
  
  for (const value of testValues) {
    const viaToLbs = units.toLbs(value, 'kg');
    const viaConvert = units.convertWeight(value, 'kg', 'lb');
    
    assert.ok(
      Math.abs(viaToLbs - viaConvert) < 0.0001,
      `toLbs(${value}, 'kg') should equal convertWeight(${value}, 'kg', 'lb')`
    );
  }
});

// --- Default Unit Behavior ---
test('Weight Conversion: Null unit defaults to lb', () => {
  // toKg with null unit should assume input is in lb
  const result = units.toKg(100, null);
  const expected = 100 * units.KG_PER_LB;
  
  assert.ok(
    Math.abs(result - expected) < 0.0001,
    `toKg(100, null) should assume lb: expected ${expected}, got ${result}`
  );
});

test('Weight Conversion: Undefined unit defaults to lb', () => {
  const result = units.toKg(100, undefined);
  const expected = 100 * units.KG_PER_LB;
  
  assert.ok(
    Math.abs(result - expected) < 0.0001,
    `toKg(100, undefined) should assume lb`
  );
});

// --- Invariant: Ordering preserved ---
test('Weight Conversion Invariant: Ordering preserved', () => {
  // If a < b in kg, then a < b in lb
  const values = [50, 75, 100, 150];
  const convertedLb = values.map(v => units.convertWeight(v, 'kg', 'lb'));
  
  for (let i = 0; i < values.length - 1; i++) {
    assert.ok(
      convertedLb[i] < convertedLb[i + 1],
      'Ordering should be preserved after conversion'
    );
  }
});
