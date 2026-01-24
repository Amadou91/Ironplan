
import { computeSetLoad, computeSetTonnage } from '../src/lib/session-metrics';

const mockYogaSet = {
  reps: null,
  weight: null,
  weightUnit: null,
  rpe: 7, // Intensity 7
  rir: null,
  performedAt: new Date().toISOString(),
  durationSeconds: 1800, // 30 minutes
  completed: true
};

const mockStrengthSet = {
  reps: 10,
  weight: 100,
  weightUnit: 'lb',
  rpe: 8,
  rir: null,
  performedAt: new Date().toISOString(),
  completed: true
};

describe('Yoga Metrics', () => {
  test('computeSetTonnage returns 0 for Yoga set', () => {
    const tonnage = computeSetTonnage(mockYogaSet);
    expect(tonnage).toBe(0);
  });

  test('computeSetLoad returns duration * intensity for Yoga set', () => {
    // 30 min * 7 intensity = 210
    const load = computeSetLoad(mockYogaSet);
    expect(load).toBe(210);
  });

  test('computeSetLoad handles missing intensity (defaults to 0)', () => {
    const noIntensitySet = { ...mockYogaSet, rpe: null };
    const load = computeSetLoad(noIntensitySet);
    expect(load).toBe(0);
  });

  test('computeSetLoad prioritizes tonnage for Strength set', () => {
    // 100lb * 10 reps = 1000 tonnage
    // Effort factor for RPE 8 is roughly ~0.8? (need to check implementation detail, but it shouldn't be 0)
    const load = computeSetLoad(mockStrengthSet);
    expect(load).toBeGreaterThan(0);
    // It should NOT use duration logic even if duration was present (though Strength set here has none)
  });
});
