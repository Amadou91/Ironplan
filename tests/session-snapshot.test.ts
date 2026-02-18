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

// Load modules under test
const snapshotModule = loadTsModule(join(__dirname, '../src/lib/session-snapshot.ts'));
const getSnapshotMetrics = snapshotModule.getSnapshotMetrics as (snapshot: unknown) => unknown;
const getSessionBodyWeight = snapshotModule.getSessionBodyWeight as (
  session: { completionSnapshot?: { bodyWeightLb?: number | null } | null; status?: string },
  current: number | null
) => number | null;

test('getSnapshotMetrics', async (t) => {
  await t.test('returns null for undefined snapshot', () => {
    assert.equal(getSnapshotMetrics(undefined), null);
  });

  await t.test('returns null for null snapshot', () => {
    assert.equal(getSnapshotMetrics(null), null);
  });

  await t.test('returns null for snapshot without computedMetrics', () => {
    assert.equal(getSnapshotMetrics({}), null);
  });

  await t.test('returns metrics from a valid snapshot', () => {
    const snapshot = {
      computedMetrics: {
        tonnage: 5000,
        totalSets: 12,
        totalReps: 60,
        workload: 100,
        hardSets: 8,
        avgEffort: 7.5,
        avgIntensity: 0.75,
        avgRestSeconds: 90,
        density: 1.2,
        sRpeLoad: 500,
        bestE1rm: null,
        bestE1rmExercise: null,
        durationMinutes: 45
      },
      e1rmFormulaVersion: '1.0'
    };
    const result = getSnapshotMetrics(snapshot) as Record<string, unknown>;
    assert.ok(result !== null);
    assert.equal(result.tonnage, 5000);
    assert.equal(result.totalSets, 12);
    assert.equal(result.totalReps, 60);
    assert.equal(result.durationMinutes, 45);
    assert.equal(result.bestE1rm, 0); // null fallback to 0
  });
});

test('getSessionBodyWeight', async (t) => {
  await t.test('returns snapshot weight for completed sessions', () => {
    const session = {
      status: 'completed',
      completionSnapshot: { bodyWeightLb: 185 }
    };
    assert.equal(getSessionBodyWeight(session, 190), 185);
  });

  await t.test('returns current weight for in-progress sessions', () => {
    const session = {
      status: 'in_progress',
      completionSnapshot: { bodyWeightLb: 185 }
    };
    assert.equal(getSessionBodyWeight(session, 190), 190);
  });

  await t.test('returns current weight when no snapshot exists', () => {
    const session = { status: 'completed' };
    assert.equal(getSessionBodyWeight(session, 175), 175);
  });

  await t.test('returns null when no weight available', () => {
    const session = { status: 'in_progress' };
    assert.equal(getSessionBodyWeight(session, null), null);
  });
});
