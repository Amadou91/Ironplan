/**
 * Training Load (ACR) Correctness Tests
 * 
 * Tests the Acute:Chronic Ratio calculation for training load management.
 * Formula: loadRatio = acuteLoad (7 days) / chronicWeeklyAvg (chronicLoad / 4)
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
  readFileSync(join(__dirname, '../fixtures/training-load-fixtures.json'), 'utf8')
);

// Load module under test
const trainingMetrics = loadTsModule(
  join(__dirname, '../../src/lib/training-metrics.ts')
) as {
  summarizeTrainingLoad: (
    sessions: Array<{ startedAt: string; sets: Array<Record<string, unknown>> }>,
    now?: Date
  ) => {
    acuteLoad: number;
    chronicLoad: number;
    chronicWeeklyAvg: number;
    loadRatio: number;
    status: 'undertraining' | 'balanced' | 'overreaching';
    daysSinceLast: number | null;
    insufficientData: boolean;
    isInitialPhase: boolean;
    weeklyLoadTrend: Array<{ week: string; load: number }>;
  };
  computeSessionMetrics: (session: Record<string, unknown>) => { workload: number };
  getLoadBasedReadiness: (summary: { status: string; daysSinceLast: number | null }) => string;
};

// Helper to create sessions from fixture data
function createSessions(
  sessionData: Array<{ daysAgo: number; workload: number }>,
  referenceDate: Date
): Array<{ startedAt: string; sets: Array<{ reps: number; weight: number; weightUnit: string; rpe: number }> }> {
  return sessionData.map(s => {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() - s.daysAgo);
    
    // Create a minimal set that produces the desired workload
    // workload ≈ tonnage * intensityFactor
    // For simplicity, create sets that approximate the workload
    // Using reps=10, weight=X, rpe=7 (intensityFactor ≈ 0.57)
    // tonnage = reps * weight, workload = tonnage * 0.57
    // So weight ≈ workload / (10 * 0.57) = workload / 5.7
    const weight = Math.round(s.workload / 5.7);
    
    return {
      startedAt: date.toISOString(),
      sets: [{ reps: 10, weight, weightUnit: 'lb', rpe: 7 }]
    };
  });
}

// Create a fixed reference date for deterministic tests
const REFERENCE_DATE = new Date('2026-01-29T12:00:00Z');

// --- Threshold Verification ---
test('ACR Thresholds: Correct values', () => {
  // Verify the documented thresholds
  assert.equal(fixtures.thresholds.overreaching, 1.3);
  assert.equal(fixtures.thresholds.undertraining, 0.8);
  assert.equal(fixtures.thresholds.minHistoryDays, 14);
  assert.equal(fixtures.thresholds.minSessionCount, 4);
});

// --- Status Classification Tests ---
test('ACR Status: Overreaching when ratio >= 1.3', () => {
  // Create sessions with high acute load relative to chronic
  const sessions = createSessions([
    { daysAgo: 1, workload: 10000 },
    { daysAgo: 2, workload: 10000 },
    { daysAgo: 3, workload: 10000 },
    { daysAgo: 15, workload: 5000 },
    { daysAgo: 18, workload: 5000 },
    { daysAgo: 22, workload: 5000 },
    { daysAgo: 25, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  assert.ok(result.loadRatio >= 1.3, `Ratio ${result.loadRatio} should be >= 1.3`);
  assert.equal(result.status, 'overreaching');
});

test('ACR Status: Undertraining when ratio <= 0.8 and chronic > 0', () => {
  // Create sessions with low acute load relative to chronic
  const sessions = createSessions([
    { daysAgo: 6, workload: 2000 },
    { daysAgo: 15, workload: 8000 },
    { daysAgo: 18, workload: 8000 },
    { daysAgo: 22, workload: 8000 },
    { daysAgo: 25, workload: 8000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  assert.ok(result.loadRatio <= 0.8, `Ratio ${result.loadRatio} should be <= 0.8`);
  assert.ok(result.chronicLoad > 0, 'Chronic load should be > 0');
  assert.equal(result.status, 'undertraining');
});

test('ACR Status: Balanced when 0.8 < ratio < 1.3', () => {
  // Create sessions with balanced load spread evenly
  const sessions = createSessions([
    { daysAgo: 2, workload: 5000 },
    { daysAgo: 5, workload: 5000 },
    { daysAgo: 9, workload: 5000 },
    { daysAgo: 13, workload: 5000 },
    { daysAgo: 17, workload: 5000 },
    { daysAgo: 21, workload: 5000 },
    { daysAgo: 25, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  assert.ok(result.loadRatio > 0.8 && result.loadRatio < 1.3, 
    `Ratio ${result.loadRatio} should be balanced (0.8-1.3)`);
  assert.equal(result.status, 'balanced');
});

// --- Initial Phase Tests ---
test('ACR Initial Phase: < 14 days history', () => {
  const sessions = createSessions([
    { daysAgo: 1, workload: 5000 },
    { daysAgo: 3, workload: 5000 },
    { daysAgo: 5, workload: 5000 },
    { daysAgo: 7, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  assert.equal(result.isInitialPhase, true, 'Should be initial phase with < 14 days');
  assert.equal(result.status, 'balanced', 'Initial phase should default to balanced');
});

test('ACR Initial Phase: < 4 sessions', () => {
  const sessions = createSessions([
    { daysAgo: 1, workload: 5000 },
    { daysAgo: 15, workload: 5000 },
    { daysAgo: 20, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  assert.equal(result.isInitialPhase, true, 'Should be initial phase with < 4 sessions');
});

// --- Edge Cases ---
test('ACR Edge Case: Empty sessions', () => {
  const result = trainingMetrics.summarizeTrainingLoad([], REFERENCE_DATE);
  
  assert.equal(result.acuteLoad, 0);
  assert.equal(result.chronicLoad, 0);
  assert.equal(result.loadRatio, 0);
  assert.equal(result.daysSinceLast, null);
  assert.equal(result.insufficientData, true);
});

test('ACR Edge Case: All sessions outside chronic window', () => {
  const sessions = createSessions([
    { daysAgo: 30, workload: 5000 },
    { daysAgo: 35, workload: 5000 },
    { daysAgo: 40, workload: 5000 },
    { daysAgo: 45, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  assert.equal(result.acuteLoad, 0, 'No acute load outside 7-day window');
  assert.equal(result.chronicLoad, 0, 'No chronic load outside 28-day window');
});

test('ACR Edge Case: Days since last tracked correctly', () => {
  const sessions = createSessions([
    { daysAgo: 5, workload: 5000 },
    { daysAgo: 10, workload: 5000 },
    { daysAgo: 15, workload: 5000 },
    { daysAgo: 20, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  assert.ok(
    Math.abs(result.daysSinceLast! - 5) <= 0.1,
    `Days since last should be ~5, got ${result.daysSinceLast}`
  );
});

// --- Property Tests ---
test('ACR Invariant: Acute load <= Chronic load (when all in window)', () => {
  // When all sessions are within the acute window, 
  // acute load equals chronic load but chronic weekly avg is lower
  const sessions = createSessions([
    { daysAgo: 1, workload: 5000 },
    { daysAgo: 3, workload: 5000 },
    { daysAgo: 5, workload: 5000 },
    { daysAgo: 10, workload: 5000 },
    { daysAgo: 15, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  assert.ok(
    result.acuteLoad <= result.chronicLoad,
    `Acute (${result.acuteLoad}) should be <= Chronic (${result.chronicLoad})`
  );
});

test('ACR Invariant: chronicWeeklyAvg = chronicLoad / 4', () => {
  const sessions = createSessions([
    { daysAgo: 1, workload: 5000 },
    { daysAgo: 8, workload: 5000 },
    { daysAgo: 15, workload: 5000 },
    { daysAgo: 22, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  // Allow for rounding
  const expectedWeeklyAvg = Math.round(result.chronicLoad / 4);
  assert.ok(
    Math.abs(result.chronicWeeklyAvg - expectedWeeklyAvg) <= 1,
    `Weekly avg ${result.chronicWeeklyAvg} should equal chronicLoad/4 (${expectedWeeklyAvg})`
  );
});

test('ACR Invariant: loadRatio = acuteLoad / chronicWeeklyAvg', () => {
  const sessions = createSessions([
    { daysAgo: 1, workload: 5000 },
    { daysAgo: 3, workload: 5000 },
    { daysAgo: 10, workload: 5000 },
    { daysAgo: 15, workload: 5000 },
    { daysAgo: 20, workload: 5000 },
  ], REFERENCE_DATE);

  const result = trainingMetrics.summarizeTrainingLoad(sessions, REFERENCE_DATE);
  
  if (result.chronicWeeklyAvg > 0) {
    const expectedRatio = result.acuteLoad / result.chronicWeeklyAvg;
    assert.ok(
      Math.abs(result.loadRatio - expectedRatio) < 0.01,
      `Ratio ${result.loadRatio} should equal acute/weeklyAvg (${expectedRatio})`
    );
  }
});

// --- Load-based Readiness ---
test('Load-based Readiness: Overreaching returns low', () => {
  const summary = { status: 'overreaching', daysSinceLast: 1 };
  const result = trainingMetrics.getLoadBasedReadiness(summary as never);
  assert.equal(result, 'low');
});

test('Load-based Readiness: Undertraining returns high', () => {
  const summary = { status: 'undertraining', daysSinceLast: 5 };
  const result = trainingMetrics.getLoadBasedReadiness(summary as never);
  assert.equal(result, 'high');
});

test('Load-based Readiness: Recent session (<=1 day) returns low', () => {
  const summary = { status: 'balanced', daysSinceLast: 0.5 };
  const result = trainingMetrics.getLoadBasedReadiness(summary as never);
  assert.equal(result, 'low');
});

test('Load-based Readiness: Balanced with recovery returns steady', () => {
  const summary = { status: 'balanced', daysSinceLast: 2 };
  const result = trainingMetrics.getLoadBasedReadiness(summary as never);
  assert.equal(result, 'steady');
});

// --- Session Row Mapping Consistency (Regression Test for ACR divergence) ---
// This test verifies that calculateTrainingStatus correctly handles implement_count and load_type
// to prevent ACR values from diverging between pages that use different data mappings.
const progressData = loadTsModule(
  join(__dirname, '../../src/lib/transformers/progress-data.ts')
) as {
  calculateTrainingStatus: (sessions: Array<{
    started_at: string;
    ended_at: string | null;
    session_exercises: Array<{
      metric_profile?: string | null;
      sets: Array<{
        reps: number | null;
        weight: number | null;
        implement_count?: number | null;
        load_type?: string | null;
        weight_unit: string | null;
        rpe: number | null;
        rir: number | null;
        completed: boolean | null;
        performed_at: string | null;
        duration_seconds?: number | null;
        rest_seconds_actual?: number | null;
      }>;
    }>;
  }>) => { acuteLoad: number; chronicLoad: number; loadRatio: number };
};

test('ACR Consistency: calculateTrainingStatus includes implementCount in tonnage', () => {
  // Simulate a dumbbell exercise with per_implement load type
  const sessions = [{
    started_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // yesterday
    ended_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
    session_exercises: [{
      metric_profile: 'weight-reps',
      sets: [{
        reps: 10,
        weight: 25, // 25 lb per dumbbell
        implement_count: 2, // 2 dumbbells
        load_type: 'per_implement',
        weight_unit: 'lb',
        rpe: 7,
        rir: null,
        completed: true,
        performed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        duration_seconds: null,
        rest_seconds_actual: null
      }]
    }]
  }];

  const result = progressData.calculateTrainingStatus(sessions);
  
  // With per_implement (25 lb * 2 implements * 10 reps = 500 lb tonnage)
  // Should NOT be 250 (missing implement count)
  assert.ok(result.acuteLoad > 0, 'acuteLoad should be calculated from dumbbell set');
  
  // Also verify direct summarizeTrainingLoad with complete mapping
  const mappedSessions = [{
    startedAt: sessions[0].started_at,
    sets: [{
      metricProfile: 'weight-reps' as const,
      reps: 10,
      weight: 25,
      implementCount: 2,
      loadType: 'per_implement' as const,
      weightUnit: 'lb' as const,
      rpe: 7,
      rir: null,
      performedAt: sessions[0].session_exercises[0].sets[0].performed_at,
      durationSeconds: null
    }]
  }];
  
  const directResult = trainingMetrics.summarizeTrainingLoad(mappedSessions);
  
  // Both approaches should yield the same acuteLoad
  assert.ok(
    Math.abs(result.acuteLoad - directResult.acuteLoad) < 0.001,
    `calculateTrainingStatus (${result.acuteLoad}) should match direct summarizeTrainingLoad (${directResult.acuteLoad})`
  );
});

test('ACR Consistency: Missing implementCount defaults correctly', () => {
  // Session WITHOUT implement_count should still work (defaults to 1)
  const sessions = [{
    started_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ended_at: null,
    session_exercises: [{
      metric_profile: 'weight-reps',
      sets: [{
        reps: 10,
        weight: 100,
        // NO implement_count or load_type
        weight_unit: 'lb',
        rpe: 7,
        rir: null,
        completed: true,
        performed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        duration_seconds: null,
        rest_seconds_actual: null
      }]
    }]
  }];

  const result = progressData.calculateTrainingStatus(sessions);
  
  // 100 lb * 10 reps = 1000 lb tonnage base, with intensity multiplier
  assert.ok(result.acuteLoad > 0, 'acuteLoad should calculate without implement_count');
});
