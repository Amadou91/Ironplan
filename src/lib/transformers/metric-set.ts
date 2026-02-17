import { computeSetLoad, type MetricsSet } from '@/lib/session-metrics'

export type SetLikeInput = {
  metricProfile?: string | null
  reps?: number | null
  weight?: number | null
  implement_count?: number | null
  implementCount?: number | null
  load_type?: string | null
  loadType?: string | null
  weight_unit?: string | null
  weightUnit?: string | null
  rpe?: number | null
  rir?: number | null
  duration_seconds?: number | null
  durationSeconds?: number | null
  performed_at?: string | null
  performedAt?: string | null
  rest_seconds_actual?: number | null
  restSecondsActual?: number | null
}

type LoadBucket = 'strength' | 'recovery'

const RECOVERY_PROFILES = new Set(['cardio_session', 'mobility_session'])

export const mapSetLikeToMetricsSet = (set: SetLikeInput): MetricsSet => ({
  metricProfile: (set.metricProfile ?? undefined) as MetricsSet['metricProfile'],
  reps: typeof set.reps === 'number' ? set.reps : null,
  weight: typeof set.weight === 'number' ? set.weight : null,
  implementCount:
    typeof set.implementCount === 'number'
      ? set.implementCount
      : typeof set.implement_count === 'number'
        ? set.implement_count
        : null,
  loadType: ((set.loadType ?? set.load_type) as MetricsSet['loadType']) ?? null,
  weightUnit: ((set.weightUnit ?? set.weight_unit) as MetricsSet['weightUnit']) ?? null,
  rpe: typeof set.rpe === 'number' ? set.rpe : null,
  rir: typeof set.rir === 'number' ? set.rir : null,
  durationSeconds:
    typeof set.durationSeconds === 'number'
      ? set.durationSeconds
      : typeof set.duration_seconds === 'number'
        ? set.duration_seconds
        : null,
  performedAt: (set.performedAt ?? set.performed_at) ?? null,
  restSecondsActual:
    typeof set.restSecondsActual === 'number'
      ? set.restSecondsActual
      : typeof set.rest_seconds_actual === 'number'
        ? set.rest_seconds_actual
        : null
})

export const getLoadBucket = (metricProfile?: string | null): LoadBucket => {
  if (metricProfile && RECOVERY_PROFILES.has(metricProfile)) return 'recovery'
  return 'strength'
}

export const computeLoadComposition = (sets: MetricsSet[]) => {
  return sets.reduce(
    (acc, set) => {
      const load = computeSetLoad(set)
      const bucket = getLoadBucket(set.metricProfile)
      if (bucket === 'recovery') {
        acc.recoveryLoad += load
      } else {
        acc.strengthLoad += load
      }
      acc.totalLoad += load
      return acc
    },
    { totalLoad: 0, strengthLoad: 0, recoveryLoad: 0 }
  )
}
