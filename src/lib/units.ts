import type { WeightUnit, DistanceUnit } from '@/types/domain'

// Physical Constants
export const LBS_PER_KG = 2.20462262
export const KG_PER_LB = 1 / LBS_PER_KG
export const METERS_PER_MILE = 1609.344
export const METERS_PER_KM = 1000

// Time Constants
export const SECONDS_PER_MINUTE = 60
export const SECONDS_PER_HOUR = 3600

/**
 * Converts a weight value to Kilograms (Internal Standard).
 */
export const toKg = (value: number, unit: WeightUnit | null | undefined): number => {
  if (!Number.isFinite(value)) return 0
  if (unit === 'kg') return value
  // Default to lbs if unit is missing (legacy assumption), or explicit lb
  return value * KG_PER_LB
}

/**
 * Converts a weight value to Pounds (User Display).
 */
export const toLbs = (value: number, unit: WeightUnit | null | undefined): number => {
  if (!Number.isFinite(value)) return 0
  if (unit === 'kg') return value * LBS_PER_KG
  return value
}

/**
 * General purpose weight converter
 */
export const convertWeight = (value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number => {
  if (!Number.isFinite(value)) return 0
  if (fromUnit === toUnit) return value
  return toUnit === 'kg' ? value * KG_PER_LB : value * LBS_PER_KG
}

/**
 * Converts distance to Meters (Internal Standard).
 */
export const toMeters = (value: number, unit: DistanceUnit): number => {
  if (!Number.isFinite(value)) return 0
  if (unit === 'm') return value
  if (unit === 'km') return value * METERS_PER_KM
  if (unit === 'miles') return value * METERS_PER_MILE
  return value
}

/**
 * Rounds a number to a specified precision.
 */
export const roundTo = (value: number, decimals = 1): number => {
  if (!Number.isFinite(value)) return value
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Legacy alias for weight rounding.
 */
export const roundWeight = roundTo

/**
 * Normalizes RPE (1-10) to a relative intensity factor (0.0 - 1.0).
 * Assumes RPE < 5 is negligible intensity for hypertrophy/strength.
 * RPE 10 = 1.0 (Max Effort)
 * RPE 5 = 0.16
 */
export const normalizeIntensity = (rpe: number | null): number => {
  if (rpe === null || !Number.isFinite(rpe)) return 0.5 // Default moderate
  const effectiveRpe = Math.max(0, Math.min(10, rpe))
  // Non-linear scaling: (RPE^2) / 100 is often used, or simple linear map from threshold.
  // Using linear mapping from RPE 4 baseline:
  if (effectiveRpe < 4) return 0.1
  return (effectiveRpe - 3) / 7 // Maps 4->0.14, 10->1.0
}