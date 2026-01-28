import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';

// --- TypeScript Loading Shim (same as generator.test.js) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const requireShim = createRequire(import.meta.url);
const moduleCache = new Map();

function loadTsModule(modulePath) {
  if (moduleCache.has(modulePath)) return moduleCache.get(modulePath);

  const moduleSource = readFileSync(modulePath, 'utf8');
  const { outputText: moduleOutput } = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  });

  const moduleShim = { exports: {} };
  const moduleDir = dirname(modulePath);

  const contextRequire = (moduleId) => {
    if (moduleId.startsWith('@/')) {
      const relativePath = moduleId.replace('@/', '');
      const resolved = join(__dirname, '../src', `${relativePath}.ts`);
      if (existsSync(resolved)) return loadTsModule(resolved);
      const resolvedIndex = join(__dirname, '../src', relativePath, 'index.ts');
      if (existsSync(resolvedIndex)) return loadTsModule(resolvedIndex);
      return loadTsModule(resolved);
    }
    // Handle specific file imports relative to src for simplicity in this shim
    if (moduleId.startsWith('.')) {
         // Naive resolution for sibling files
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
// ------------------------------------------------------------

// Load the module under test
const modulePath = join(__dirname, '../src/lib/metric-derivation.ts');
const { deriveMetricProfile } = loadTsModule(modulePath);

test('deriveMetricProfile', async (t) => {
  await t.test('should derive cardio_session for Cardio category', () => {
    const result = deriveMetricProfile('Cardio', 'endurance');
    assert.equal(result.profile, 'cardio_session');
    assert.equal(result.isAmbiguous, false);
  });

  await t.test('should derive mobility_session for Mobility category', () => {
    const result = deriveMetricProfile('Mobility', 'range_of_motion');
    assert.equal(result.profile, 'mobility_session');
    assert.equal(result.isAmbiguous, false);
  });

  await t.test('should derive strength for Strength category with standard goals', () => {
    const result = deriveMetricProfile('Strength', 'strength');
    assert.equal(result.profile, 'strength');
    assert.equal(result.isAmbiguous, false);

    const result2 = deriveMetricProfile('Strength', 'hypertrophy');
    assert.equal(result2.profile, 'strength');
    assert.equal(result2.isAmbiguous, false);
  });

  await t.test('should flag ambiguity for Strength + Endurance', () => {
    const result = deriveMetricProfile('Strength', 'endurance');
    assert.equal(result.profile, 'strength'); // Default
    assert.equal(result.isAmbiguous, true);
    assert.ok(result.options && result.options.length > 1);
  });

  await t.test('should default to strength for undefined category', () => {
    const result = deriveMetricProfile(undefined, undefined);
    assert.equal(result.profile, 'strength');
    assert.equal(result.isAmbiguous, false);
  });
});